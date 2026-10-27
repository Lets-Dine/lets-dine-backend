import { KitchenStation } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IKitchenTicket } from "../interfaces/kitchen-ticket.interface";
import { SentLine, TicketLineDraft } from "../utils/ticket-delta.util";

export interface IKitchenTicketCreate {
  branchId: string;
  orderId: string;
  station: KitchenStation;
  lines: Omit<TicketLineDraft, "station">[];
}

export abstract class KitchenTicketRepository {
  /** Every line already sent for this order, each with the station of the ticket it went out on. */
  abstract findSentLines(orderId: string, options?: { tx?: PrismaTransaction }): Promise<SentLine[]>;
  /** Stops counting this order line's sent quantity as outstanding — for a cooked line being deleted, which must never be voided. */
  abstract detachItem(orderItemId: string, options?: { tx?: PrismaTransaction }): Promise<void>;
  /** A branch's tickets for one station whose order is still open, oldest first. */
  abstract findOpenByBranch(branchId: string, station: KitchenStation, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket[]>;
  /** Tickets nobody has acknowledged or printed yet — on these stations, or among `alsoTicketIds` — whose order is still open, oldest first. */
  abstract findUnacknowledged(
    branchId: string,
    stations: KitchenStation[],
    alsoTicketIds: string[],
    options?: { tx?: PrismaTransaction }
  ): Promise<IKitchenTicket[]>;
  abstract findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket | null>;
  abstract findManyByIds(ids: string[], options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket[]>;
  /** A slip carrying these tickets came out — only the ones not already marked are touched. */
  abstract markPrintedMany(ids: string[], at: Date, options?: { tx?: PrismaTransaction }): Promise<void>;
  /** Hides one ticket from the front-of-house warning. Idempotent. */
  abstract dismissWarning(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<void>;
  /** Idempotent — the first tap wins, a second one changes nothing. */
  abstract acknowledge(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket>;
  /** Takes the branch's next ticket number atomically, then writes the ticket and its lines. */
  abstract create(data: IKitchenTicketCreate, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket>;
}
