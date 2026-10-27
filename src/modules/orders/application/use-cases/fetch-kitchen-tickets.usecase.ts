import { Injectable } from "@nestjs/common";
import { KitchenStation } from "@prisma/client";
import { AuthEntity } from "../../../../common/interfaces";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";

/** What a kitchen or bar screen loads on open and after a reconnect — the live socket only carries what comes next. */
@Injectable()
export class FetchKitchenTicketsUsecase {
  constructor(private readonly ticketRepository: KitchenTicketRepository) {}

  execute(station: KitchenStation, authEntity: AuthEntity): Promise<IKitchenTicket[]> {
    return this.ticketRepository.findOpenByBranch(authEntity.branchId, station);
  }
}
