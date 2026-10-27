import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { PrintJobRepository } from "../../domain/repositories/print-job.repository";
import { PENDING_WINDOW_MS } from "./print-jobs.usecases";

/**
 * What the front of house is told the kitchen hasn't seen — neither a tap on its screen nor a slip out of its
 * printer. Two kinds of ticket count: any for a station the branch says has a screen, and any with a slip
 * still waiting on an active printer (so a printer-only kitchen is covered, and a station is never warned
 * about for orders no printer was ever going to print). Each ticket says which of the two it is waiting on.
 */
@Injectable()
export class FetchUnacknowledgedTicketsUsecase {
  constructor(
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly branchRepository: BranchRepository,
    private readonly printJobRepository: PrintJobRepository
  ) {}

  async execute(authEntity: AuthEntity): Promise<IKitchenTicket[]> {
    const branch = await this.branchRepository.findById(authEntity.branchId);
    if (!branch || branch.restaurantId !== authEntity.restaurantId) return [];
    const waiting = await this.printJobRepository.findPendingTicketIds(branch.id, new Date(Date.now() - PENDING_WINDOW_MS));
    const tickets = await this.ticketRepository.findUnacknowledged(branch.id, branch.ackStations, waiting);
    // Say what is missing: a person at a screen (the station has one), or a slip from a printer (it only has that).
    return tickets.map(ticket => ({ ...ticket, unconfirmed: branch.ackStations.includes(ticket.station) ? "screen" : "printer" }));
  }
}
