import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IAuditLog } from "../../domain/interfaces/audit-log.interface";
import {
  AuditLogRepository,
  IAuditLogCreate,
  IAuditLogsFetchOptions,
  IAuditLogsFetchQuery,
} from "../../domain/repositories/audit-log.repository";

@Injectable()
class AuditLogRepositoryImpl implements AuditLogRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: IAuditLogCreate, options?: { tx?: PrismaTransaction }): Promise<IAuditLog> {
    const prisma = options?.tx ?? this.prisma;
    const entry = await prisma.auditLog.create({ data: { ...data, detail: data.detail ?? "" } });
    return entry as IAuditLog;
  }

  async fetchAll(query: IAuditLogsFetchQuery, options?: IAuditLogsFetchOptions): Promise<PaginatedResponse<IAuditLog>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});

    const where: Prisma.AuditLogWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.action && { action: query.action }),
      ...(query.actorId && { actorId: query.actorId }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.auditLog.findMany({ where, ...paginationQuery, orderBy: orderBy ?? { createdAt: "desc" } }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.auditLog.count({ where }),
    ]);

    return { rows: rows as IAuditLog[], count: count ?? 0 };
  }
}

export default AuditLogRepositoryImpl;
