import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { PrinterRepository } from "../../../printers/domain/repositories/printer.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { PrintJobRepository } from "../../domain/repositories/print-job.repository";
import { routePrintJobs } from "../../domain/utils/print-routing.util";
import { KITCHEN_TICKET_UPDATED } from "../kitchen-ticket.service";

/** Only an order the kitchen is still working has a slip worth printing: reprinting a finished one would have it cooked again. */
const COOKING: OrderStatus[] = [OrderStatus.ACCEPTED, OrderStatus.PREPARING];

/**
 * Sends an order's latest kitchen ticket per station to the printers again: the slip was lost, jammed or never came out.
 * Only the latest, because the older ones are history (a "+2 Burger" slip followed by a cancellation would reprint as a
 * fresh 2 Burgers). It routes exactly as the first print did, and only queues jobs: nothing about the order changes.
 */
@Injectable()
export class ReprintKitchenTicketsUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly printJobRepository: PrintJobRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(orderId: string, authEntity: AuthEntity): Promise<{ jobs: number }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || !isInActiveBranch(authEntity, order)) throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);

    if (!COOKING.includes(order.status)) throw new BadRequestException(ORDER_ERROR_MESSAGES.ORDER_NOT_COOKING);

    const sent = await this.ticketRepository.findByOrder(orderId);
    // `findByOrder` is oldest first, so the last of each station wins.
    const latest = [...new Map(sent.map(ticket => [ticket.station, ticket])).values()];
    if (latest.length === 0) throw new BadRequestException(ORDER_ERROR_MESSAGES.TICKET_NOT_SENT);
    const tickets = latest;

    const printers = await this.printerRepository.findByBranch(order.branchId, { activeOnly: true });
    const jobs = routePrintJobs(tickets, { tableId: order.tableId, floorId: order.floorId, orderType: order.orderType }, printers);
    if (jobs.length === 0) throw new BadRequestException(ORDER_ERROR_MESSAGES.NO_PRINTER_FOR_ORDER);

    await this.printJobRepository.createMany(jobs.map(job => ({ ...job, branchId: order.branchId, orderId })));
    // The printing PC reloads its queue on a ticket event, so wake it.
    for (const ticket of tickets) this.eventEmitter.emit(KITCHEN_TICKET_UPDATED, ticket);
    return { jobs: jobs.length };
  }
}
