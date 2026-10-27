import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { KITCHEN_TICKET_UPDATED } from "../kitchen-ticket.service";

/** An explicit tap on the pass: someone saw this ticket. An open screen alone proves nothing. */
@Injectable()
export class AcknowledgeKitchenTicketUsecase {
  constructor(
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IKitchenTicket> {
    const ticket = await this.ticketRepository.findById(id);
    // A ticket carries its branch; the token's branch is already inside the token's restaurant.
    if (!ticket || ticket.branchId !== authEntity.branchId) throw new NotFoundException(ORDER_ERROR_MESSAGES.TICKET_NOT_FOUND);
    if (ticket.acknowledgedAt) return ticket;

    const acknowledged = await this.ticketRepository.acknowledge(id, new Date());
    this.eventEmitter.emit(KITCHEN_TICKET_UPDATED, acknowledged);
    return acknowledged;
  }
}
