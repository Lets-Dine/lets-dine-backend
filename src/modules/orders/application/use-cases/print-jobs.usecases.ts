import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IPrintJob } from "../../domain/interfaces/print-job.interface";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { IPrintJobRow, PrintJobRepository } from "../../domain/repositories/print-job.repository";
import { KITCHEN_TICKET_UPDATED } from "../kitchen-ticket.service";

/** A job nobody has printed after this long is dropped from the queue — a slip hours old is just noise. */
export const PENDING_WINDOW_MS = 6 * 60 * 60 * 1000;
/** How long a claim holds before another PC may take the job (the first died mid-print). Long enough to outlast QZ's "allow this site" prompt. */
const CLAIM_TTL_MS = 5 * 60 * 1000;

async function ownJob(repo: PrintJobRepository, id: string, authEntity: AuthEntity): Promise<IPrintJobRow> {
  const job = await repo.findRowById(id);
  if (!job || job.branchId !== authEntity.branchId) throw new NotFoundException(ORDER_ERROR_MESSAGES.PRINT_JOB_NOT_FOUND);
  return job;
}

/** What the printing PC loads on connect and after every ticket event. */
@Injectable()
export class FetchPendingPrintJobsUsecase {
  constructor(private readonly jobs: PrintJobRepository) {}

  execute(authEntity: AuthEntity): Promise<IPrintJob[]> {
    return this.jobs.findPending(authEntity.branchId, new Date(Date.now() - PENDING_WINDOW_MS));
  }
}

/** Two PCs running the same dashboard must not print the same slip twice — whoever claims it prints it. */
@Injectable()
export class ClaimPrintJobUsecase {
  constructor(private readonly jobs: PrintJobRepository) {}

  async execute(id: string, claimant: string, authEntity: AuthEntity): Promise<{ claimed: boolean }> {
    await ownJob(this.jobs, id, authEntity);
    const now = new Date();
    return { claimed: await this.jobs.claim(id, claimant, now, new Date(now.getTime() - CLAIM_TTL_MS)) };
  }
}

/** The slip came out: the job is done, and its tickets count as received so the kitchen warning stands down. */
@Injectable()
export class CompletePrintJobUsecase {
  constructor(
    private readonly jobs: PrintJobRepository,
    private readonly ticketRepository: KitchenTicketRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const job = await ownJob(this.jobs, id, authEntity);
    const at = new Date();
    // Both writes are idempotent and deliberately not short-circuited on `printedAt`: if the second threw
    // last time, the retry must still get to it, or the tickets would stay "unprinted" for good.
    await this.jobs.complete(id, at);
    await this.ticketRepository.markPrintedMany(job.ticketIds, at);
    if (job.printedAt) return;
    for (const ticket of await this.ticketRepository.findManyByIds(job.ticketIds)) this.eventEmitter.emit(KITCHEN_TICKET_UPDATED, ticket);
  }
}

@Injectable()
export class FailPrintJobUsecase {
  constructor(private readonly jobs: PrintJobRepository) {}

  async execute(id: string, claimant: string, error: string, authEntity: AuthEntity): Promise<void> {
    await ownJob(this.jobs, id, authEntity);
    await this.jobs.fail(id, claimant, error);
  }
}
