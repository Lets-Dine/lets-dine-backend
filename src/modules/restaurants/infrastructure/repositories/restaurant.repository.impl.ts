import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import {
  IRestaurantCreate,
  IRestaurantsFetchOptions,
  IRestaurantsFetchQuery,
  IRestaurantUpdate,
  RestaurantFetchOptions,
  RestaurantRepository,
} from "../../domain/repositories/restaurant.repository";

@Injectable()
class RestaurantRepositoryImpl implements RestaurantRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: RestaurantFetchOptions): Promise<IRestaurant | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.restaurant.findUnique({ where: { id } });
  }

  async findBySlug(slug: string, options?: RestaurantFetchOptions): Promise<IRestaurant | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.restaurant.findUnique({ where: { slug } });
  }

  async create(data: IRestaurantCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IRestaurant> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.restaurant.create({
      data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId },
    });
  }

  async update(id: string, data: IRestaurantUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IRestaurant> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.restaurant.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IRestaurantsFetchQuery, options?: IRestaurantsFetchOptions): Promise<PaginatedResponse<IRestaurant>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "createdAt">(options ?? {});

    const where: Prisma.RestaurantWhereInput = {
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.restaurant.findMany({ where, ...paginationQuery, orderBy: orderBy ?? { name: "asc" } }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.restaurant.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }
}

export default RestaurantRepositoryImpl;
