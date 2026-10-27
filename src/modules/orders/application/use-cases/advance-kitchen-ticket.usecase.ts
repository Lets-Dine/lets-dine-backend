import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderItemStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { AdvanceKitchenTicketInput } from "../../interfaces/http/validations/advance-kitchen-ticket.validation";
import { KITCHEN_TICKET_READY, KITCHEN_TICKET_UPDATED } from "../kitchen-ticket.service";
import { AdvanceOrderItemStatusUsecase } from "./advance-order-item-status.usecase";

const STEPS = [OrderItemStatus.PREPARING, OrderItemStatus.READY] as const;
/** Only the states a screen can move a line through; anything else (cancelled, served) is left alone. */
const RANK: Partial<Record<OrderItemStatus, number>> = {
  [OrderItemStatus.PENDING]: 0,
  [OrderItemStatus.PREPARING]: 1,
  [OrderItemStatus.READY]: 2,
};

/**
 * The kitchen's own buttons: "Start" and "Ready" on a ticket. The order line stays the unit
 * that moves (§20), so this just walks each line the ticket asked for through the same
 * per-line use case staff already use — stock, audit and order status all follow from that.
 *
 * ponytail: a repeat plate merged into a still-PENDING line moves with that whole line.
 * A per-ticket quantity would need split lines; add it if a kitchen cooks the repeat apart.
 */
@Injectable()
export class AdvanceKitchenTicketUsecase {
  constructor(
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly orderRepository: OrderRepository,
    private readonly advanceItem: AdvanceOrderItemStatusUsecase,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, dto: AdvanceKitchenTicketInput, authEntity: AuthEntity): Promise<IKitchenTicket> {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.branchId !== authEntity.branchId) throw new NotFoundException(ORDER_ERROR_MESSAGES.TICKET_NOT_FOUND);

    const itemIds = [
      ...new Set(ticket.lines.filter(line => line.qtyDelta > 0 && line.orderItemId).map(line => line.orderItemId as string)),
    ];
    if (itemIds.length === 0) throw new BadRequestException(ORDER_ERROR_MESSAGES.TICKET_NOTHING_TO_ADVANCE);

    const order = await this.orderRepository.findById(ticket.orderId);
    if (!order) throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);

    for (const itemId of itemIds) {
      const item = order.items.find(candidate => candidate.id === itemId);
      if (!item) continue;
      // Walk one step at a time (PENDING → PREPARING → READY). A line already at or past a step, or
      // cancelled/served, is skipped rather than failing the whole ticket.
      for (const step of STEPS.slice(0, STEPS.indexOf(dto.status) + 1)) {
        const have = RANK[item.status];
        if (have === undefined || have >= (RANK[step] as number)) continue;
        await this.advanceItem.execute(order.id, itemId, { status: step }, authEntity);
        item.status = step;
      }
    }

    // Starting or finishing a ticket is proof someone saw it.
    if (!ticket.acknowledgedAt) await this.ticketRepository.acknowledge(id, new Date());
    const updated = (await this.ticketRepository.findById(id)) as IKitchenTicket;
    this.eventEmitter.emit(KITCHEN_TICKET_UPDATED, updated);
    if (dto.status === OrderItemStatus.READY) this.eventEmitter.emit(KITCHEN_TICKET_READY, updated);
    return updated;
  }
}
