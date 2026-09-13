import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDish } from "../../domain/interfaces/dish.interface";
import {
  DishFetchOptions,
  DishRepository,
  IDishCreate,
  IDishesFetchOptions,
  IDishesFetchQuery,
  IDishUpdate,
} from "../../domain/repositories/dish.repository";

@Injectable()
class DishRepositoryImpl implements DishRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: DishFetchOptions): Promise<IDish | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findUnique({ where: { id } });
  }

  async findBySlug(restaurantId: string, slug: string, options?: DishFetchOptions): Promise<IDish | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } });
  }

  async findManyByIds(ids: string[], options?: DishFetchOptions): Promise<IDish[]> {
    if (ids.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findMany({ where: { id: { in: ids } } });
  }

  async create(data: IDishCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IDishUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IDishesFetchQuery, options?: IDishesFetchOptions): Promise<PaginatedResponse<IDish>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "price" | "sortOrder" | "createdAt">(options ?? {});

    const where: Prisma.DishWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.ids && { id: { in: query.ids } }),
      ...(query.isAvailable !== undefined && { isAvailable: query.isAvailable }),
      ...(query.isArchived !== undefined && { isArchived: query.isArchived }),
      ...(query.isFeatured !== undefined && { isFeatured: query.isFeatured }),
      ...(query.keyword && {
        OR: [
          { name: { contains: query.keyword, mode: "insensitive" as const } },
          { description: { contains: query.keyword, mode: "insensitive" as const } },
        ],
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.dish.findMany({
            where,
            ...paginationQuery,
            orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }],
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.dish.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }
}

export default DishRepositoryImpl;
