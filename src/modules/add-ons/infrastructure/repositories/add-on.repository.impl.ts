import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import {
  AddOnFetchOptions,
  AddOnRepository,
  IAddOnCreate,
  IAddOnsFetchOptions,
  IAddOnsFetchQuery,
  IAddOnUpdate,
} from "../../domain/repositories/add-on.repository";

@Injectable()
class AddOnRepositoryImpl implements AddOnRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: AddOnFetchOptions): Promise<IAddOn | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.addOn.findUnique({ where: { id } });
  }

  async findManyByIds(ids: string[], options?: AddOnFetchOptions): Promise<IAddOn[]> {
    if (ids.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    return prisma.addOn.findMany({ where: { id: { in: ids } } });
  }

  async create(data: IAddOnCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IAddOn> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.addOn.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IAddOnUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IAddOn> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.addOn.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IAddOnsFetchQuery, options?: IAddOnsFetchOptions): Promise<PaginatedResponse<IAddOn>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "price" | "sortOrder" | "createdAt">(options ?? {});

    const where: Prisma.AddOnWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.ids && { id: { in: query.ids } }),
      ...(query.isAvailable !== undefined && { isAvailable: query.isAvailable }),
      ...(query.isArchived !== undefined && { isArchived: query.isArchived }),
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" as const } }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.addOn.findMany({ where, ...paginationQuery, orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }] }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.addOn.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }

  async findLinkedToDish(dishId: string, options?: AddOnFetchOptions): Promise<IAddOn[]> {
    const prisma = options?.tx ?? this.prisma;
    const links = await prisma.dishAddOn.findMany({ where: { dishId }, include: { addOn: true } });
    return links.map(link => link.addOn);
  }

  async findLinkedIdsByDishIds(dishIds: string[], options?: AddOnFetchOptions): Promise<Record<string, string[]>> {
    if (dishIds.length === 0) return {};
    const prisma = options?.tx ?? this.prisma;
    const links = await prisma.dishAddOn.findMany({ where: { dishId: { in: dishIds } } });

    const byDish: Record<string, string[]> = {};
    for (const link of links) (byDish[link.dishId] ??= []).push(link.addOnId);
    return byDish;
  }

  async setDishLinks(dishId: string, addOnIds: string[], options?: { tx?: PrismaTransaction }): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.dishAddOn.deleteMany({ where: { dishId } });
    if (addOnIds.length > 0) {
      await prisma.dishAddOn.createMany({ data: addOnIds.map(addOnId => ({ dishId, addOnId })) });
    }
  }
}

export default AddOnRepositoryImpl;
