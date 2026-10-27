import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { KitchenStation, OrderStatus } from "@prisma/client";
import { PrismaTransaction } from "../../../common/prisma";
import { DishRepository } from "../../dishes/domain/repositories/dish.repository";
import { IKitchenTicket } from "../domain/interfaces/kitchen-ticket.interface";
import { KitchenTicketRepository } from "../domain/repositories/kitchen-ticket.repository";
import { PrintJobRepository } from "../domain/repositories/print-job.repository";
import { PrinterRepository } from "../../printers/domain/repositories/printer.repository";
import { routePrintJobs } from "../domain/utils/print-routing.util";
import { OrderRepository } from "../domain/repositories/order.repository";
import { diffTicketLines } from "../domain/utils/ticket-delta.util";

export const KITCHEN_TICKET_CREATED = "kitchen.ticket.created";
export const KITCHEN_TICKET_UPDATED = "kitchen.ticket.updated";
/** A station finished a ticket — the floor should come and get it. */
export const KITCHEN_TICKET_READY = "kitchen.ticket.ready";

/**
 * Brings the kitchen and bar passes in line with an order. Call it inside the same
 * transaction as any order edit that can change what is being cooked — accepting,
 * adding, removing, cancelling — then `announce` the result once that commits.
 * It diffs the order against what was already sent, so calling it when nothing
 * changed (or twice) writes nothing.
 *
 * A PENDING order has not been accepted, so nothing is sent yet; accepting it sends
 * everything. A bill correction on an already-COMPLETED order must not call this at all
 * (see `RemoveOrderItemUsecase`) — an edit that *causes* completion still has to void.
 */
@Injectable()
export class KitchenTicketService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly dishRepository: DishRepository,
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly printJobRepository: PrintJobRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async reconcile(orderId: string, tx: PrismaTransaction): Promise<IKitchenTicket[]> {
    const order = await this.orderRepository.findById(orderId, { tx });
    if (!order || order.status === OrderStatus.PENDING) return [];

    const dishes = await this.dishRepository.findManyByIds([...new Set(order.items.map(item => item.dishId))], { tx });
    const stationOf = new Map(dishes.map(dish => [dish.id, dish.station]));
    const items = order.items.map(item => ({
      ...item,
      station: stationOf.get(item.dishId) ?? KitchenStation.KITCHEN,
      addOnNames: item.addOns.map(addOn => addOn.nameSnapshot),
    }));

    const drafts = diffTicketLines(items, await this.ticketRepository.findSentLines(orderId, { tx }));

    const tickets: IKitchenTicket[] = [];
    for (const station of Object.values(KitchenStation)) {
      const lines = drafts.filter(draft => draft.station === station).map(({ station: _station, ...line }) => line);
      if (!lines.length) continue;
      const ticket = await this.ticketRepository.create({ branchId: order.branchId, orderId, station, lines }, { tx });
      tickets.push({
        ...ticket,
        // The live copy a screen receives must carry what a fetched one does, or it can't tell what still needs cooking.
        lines: ticket.lines.map(line => ({ ...line, itemStatus: order.items.find(item => item.id === line.orderItemId)?.status ?? null })),
        order: {
          reference: order.reference,
          orderType: order.orderType,
          tableName: order.tableName,
          floorName: order.floorName,
          floorVisitorName: order.floorVisitorName,
        },
      });
    }
    // Which printers get these, decided in the same transaction so a ticket is never without its slip.
    if (tickets.length) {
      const printers = await this.printerRepository.findByBranch(order.branchId, { tx, activeOnly: true });
      const jobs = routePrintJobs(tickets, { tableId: order.tableId, floorId: order.floorId }, printers);
      await this.printJobRepository.createMany(
        jobs.map(job => ({ ...job, branchId: order.branchId, orderId })),
        { tx }
      );
    }
    return tickets;
  }

  /** A cooked line is being deleted from the order — keep it on its ticket but never void it. */
  detachItem(orderItemId: string, tx: PrismaTransaction): Promise<void> {
    return this.ticketRepository.detachItem(orderItemId, { tx });
  }

  /** Post-commit only — the pass must never hear about a ticket a rollback could still erase. */
  announce(tickets: IKitchenTicket[]): void {
    for (const ticket of tickets) this.eventEmitter.emit(KITCHEN_TICKET_CREATED, ticket);
  }
}
