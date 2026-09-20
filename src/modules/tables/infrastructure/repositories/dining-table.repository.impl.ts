import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";
import {
  DiningTableFetchOptions,
  DiningTableRepository,
  IDiningTableCreate,
  IDiningTablesFetchOptions,
  IDiningTablesFetchQuery,
  IDiningTableUpdate,
} from "../../domain/repositories/dining-table.repository";

@Injectable()
class DiningTableRepositoryImpl implements DiningTableRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async lockById(id: string, options: { tx: PrismaTransaction }): Promise<void> {
    await options.tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "dining_tables"
      WHERE "id" = ${id}::uuid
      FOR UPDATE
    `;
  }

  async findById(id: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningTable.findUnique({ where: { id } }) as any;
  }

  async findByQrToken(qrToken: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningTable.findUnique({ where: { qrToken } }) as any;
  }

  async findByName(restaurantId: string, name: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningTable.findUnique({ where: { restaurantId_name: { restaurantId, name } } }) as any;
  }

  async create(data: IDiningTableCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDiningTable> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningTable.create({
      data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId },
    }) as any;
  }

  async update(id: string, data: IDiningTableUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDiningTable> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningTable.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } }) as any;
  }

  async fetchAll(query: IDiningTablesFetchQuery, options?: IDiningTablesFetchOptions): Promise<PaginatedResponse<IDiningTable>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "sortOrder" | "createdAt">(options ?? {});

    const where: Prisma.DiningTableWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.diningTable.findMany({
            where,
            ...paginationQuery,
            orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }],
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.diningTable.count({ where }),
    ]);

    return { rows: rows as IDiningTable[], count: count ?? 0 };
  }
}

export default DiningTableRepositoryImpl;
