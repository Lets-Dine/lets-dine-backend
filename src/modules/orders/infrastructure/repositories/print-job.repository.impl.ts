import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPrintJob } from "../../domain/interfaces/print-job.interface";
import { IPrintJobCreate, IPrintJobRow, PrintJobRepository } from "../../domain/repositories/print-job.repository";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";

@Injectable()
class PrintJobRepositoryImpl implements PrintJobRepository {
  constructor(
    private prisma: PrismaService,
    private ticketRepository: KitchenTicketRepository
  ) {}

  async createMany(jobs: IPrintJobCreate[], options?: { tx?: PrismaTransaction }): Promise<void> {
    if (jobs.length === 0) return;
    await (options?.tx ?? this.prisma).printJob.createMany({ data: jobs });
  }

  async findRowById(id: string, options?: { tx?: PrismaTransaction }): Promise<IPrintJobRow | null> {
    return (options?.tx ?? this.prisma).printJob.findUnique({
      where: { id },
      select: { id: true, branchId: true, printedAt: true, ticketIds: true },
    });
  }

  async findPending(branchId: string, since: Date, options?: { tx?: PrismaTransaction }): Promise<IPrintJob[]> {
    const prisma = options?.tx ?? this.prisma;
    const rows = await prisma.printJob.findMany({
      where: { branchId, printedAt: null, createdAt: { gte: since }, printer: { isActive: true } },
      include: { printer: { select: { id: true, name: true, ipAddress: true, port: true, paperWidth: true } } },
      orderBy: { createdAt: "asc" },
    });
    const tickets = await this.ticketRepository.findManyByIds([...new Set(rows.flatMap(row => row.ticketIds))], options);
    const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
    return rows.map(({ ticketIds, branchId: _branchId, printerId: _printerId, printedAt: _printedAt, ...row }) => ({
      ...row,
      tickets: ticketIds.map(id => byId.get(id)).filter((ticket): ticket is NonNullable<typeof ticket> => Boolean(ticket)),
    }));
  }

  async claim(id: string, claimant: string, now: Date, staleBefore: Date, options?: { tx?: PrismaTransaction }): Promise<boolean> {
    const { count } = await (options?.tx ?? this.prisma).printJob.updateMany({
      where: { id, printedAt: null, OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
      data: { claimedAt: now, claimedBy: claimant },
    });
    return count === 1;
  }

  async complete(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<void> {
    await (options?.tx ?? this.prisma).printJob.updateMany({ where: { id, printedAt: null }, data: { printedAt: at, lastError: null } });
  }

  async findPendingTicketIds(branchId: string, since: Date, options?: { tx?: PrismaTransaction }): Promise<string[]> {
    const rows = await (options?.tx ?? this.prisma).printJob.findMany({
      // Only printers that asked to be warned about: a quiet printer still prints, it just never nags.
      where: { branchId, printedAt: null, createdAt: { gte: since }, printer: { isActive: true, warnIfUnprinted: true } },
      select: { ticketIds: true },
    });
    return [...new Set(rows.flatMap(row => row.ticketIds))];
  }

  async fail(id: string, claimant: string, error: string, options?: { tx?: PrismaTransaction }): Promise<void> {
    await (options?.tx ?? this.prisma).printJob.updateMany({
      where: { id, printedAt: null, claimedBy: claimant },
      data: { claimedAt: null, claimedBy: null, attempts: { increment: 1 }, lastError: error.slice(0, 300) },
    });
  }
}

export default PrintJobRepositoryImpl;
