import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";

/**
 * "I know — I've told them." Stops the front-of-house warning for one ticket without pretending the
 * station saw it: its screen still shows it as unseen, and a waiting slip still prints.
 */
@Injectable()
export class DismissKitchenTicketWarningUsecase {
  constructor(private readonly ticketRepository: KitchenTicketRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.branchId !== authEntity.branchId) throw new NotFoundException(ORDER_ERROR_MESSAGES.TICKET_NOT_FOUND);
    await this.ticketRepository.dismissWarning(id, new Date());
  }
}
