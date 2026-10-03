import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IFloor } from "../../domain/interfaces/floor.interface";
import {
  FloorFetchOptions,
  FloorRepository,
  IFloorCreate,
  IFloorsFetchOptions,
  IFloorsFetchQuery,
  IFloorUpdate,
} from "../../domain/repositories/floor.repository";

@Injectable()
class FloorRepositoryImpl implements FloorRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: FloorFetchOptions): Promise<IFloor | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.floor.findUnique({ where: { id } });
  }

  async findByQrToken(qrToken: string, options?: FloorFetchOptions): Promise<IFloor | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.floor.findUnique({ where: { qrToken } });
  }

  async findByName(branchId: string, name: string, options?: FloorFetchOptions): Promise<IFloor | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.floor.findUnique({ where: { branchId_name: { branchId, name } } });
  }

  async create(data: IFloorCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IFloor> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.floor.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IFloorUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IFloor> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.floor.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IFloorsFetchQuery, options?: IFloorsFetchOptions): Promise<PaginatedResponse<IFloor>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "sortOrder" | "createdAt">(options ?? {});

    const where: Prisma.FloorWhereInput = {
      restaurantId: query.restaurantId,
      branchId: query.branchId,
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.floor.findMany({ where, ...paginationQuery, orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }] }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.floor.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }
}

export default FloorRepositoryImpl;
