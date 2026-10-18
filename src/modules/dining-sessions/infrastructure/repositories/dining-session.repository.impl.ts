import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDiningSession, IServiceRequest } from "../../domain/interfaces/dining-session.interface";
import {
  DiningSessionFetchOptions,
  DiningSessionRepository,
  IDiningSessionCreate,
  IDiningSessionUpdate,
} from "../../domain/repositories/dining-session.repository";

@Injectable()
class DiningSessionRepositoryImpl implements DiningSessionRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.findUnique({ where: { id } });
  }

  async findByToken(token: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.findUnique({ where: { anonymousSessionToken: token } });
  }

  async findOpenByTableId(tableId: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.findFirst({
      where: { tableId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
  }

  async findActiveByTableId(tableId: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    const now = new Date();
    return prisma.diningSession.findFirst({
      where: {
        tableId,
        endedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  async findServiceRequests(restaurantId: string, branchId: string): Promise<IServiceRequest[]> {
    const rows = await this.prisma.diningSession.findMany({
      where: {
        restaurantId,
        branchId,
        endedAt: null,
        expiresAt: { gt: new Date() },
        OR: [{ waiterCalledAt: { not: null } }, { billRequestedAt: { not: null } }],
      },
      include: { table: { select: { name: true } }, floor: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    });
    return rows.map(row => ({
      sessionId: row.id,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      label: row.table?.name ?? row.floor?.name ?? "Table",
      waiterCalledAt: row.waiterCalledAt,
      billRequestedAt: row.billRequestedAt,
    }));
  }

  async create(data: IDiningSessionCreate, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.create({ data });
  }

  async update(id: string, data: IDiningSessionUpdate, transaction?: PrismaTransaction): Promise<IDiningSession> {
    const prisma = transaction ?? this.prisma;
    return prisma.diningSession.update({ where: { id }, data });
  }
}

export default DiningSessionRepositoryImpl;
