import { PrismaTransaction } from "../../../../common/prisma";
import { IPrintJob } from "../interfaces/print-job.interface";

export interface IPrintJobCreate {
  branchId: string;
  printerId: string;
  orderId: string;
  ticketIds: string[];
}

export interface IPrintJobRow {
  id: string;
  branchId: string;
  printedAt: Date | null;
  ticketIds: string[];
}

export abstract class PrintJobRepository {
  abstract createMany(jobs: IPrintJobCreate[], options?: { tx?: PrismaTransaction }): Promise<void>;
  abstract findRowById(id: string, options?: { tx?: PrismaTransaction }): Promise<IPrintJobRow | null>;
  /** Unprinted jobs younger than `since`, oldest first, each with its printer and tickets. */
  abstract findPending(branchId: string, since: Date, options?: { tx?: PrismaTransaction }): Promise<IPrintJob[]>;
  /** True only for the one caller that got it — a job already claimed within `staleBefore` is left alone. */
  abstract claim(id: string, claimant: string, now: Date, staleBefore: Date, options?: { tx?: PrismaTransaction }): Promise<boolean>;
  /** Ticket ids that have a slip still waiting on an active printer, so the front of house can warn about them. */
  abstract findPendingTicketIds(branchId: string, since: Date, options?: { tx?: PrismaTransaction }): Promise<string[]>;
  abstract complete(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<void>;
  /** Releases the claim — but only if `claimant` still holds it, so a slow PC can't undo another's live print. */
  abstract fail(id: string, claimant: string, error: string, options?: { tx?: PrismaTransaction }): Promise<void>;
}
