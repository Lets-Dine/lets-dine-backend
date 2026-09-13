import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";
import {
  IMenuCategoriesFetchOptions,
  IMenuCategoriesFetchQuery,
  IMenuCategoryCreate,
  IMenuCategoryUpdate,
  MenuCategoryFetchOptions,
  MenuCategoryRepository,
} from "../../domain/repositories/menu-category.repository";

@Injectable()
class MenuCategoryRepositoryImpl implements MenuCategoryRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: MenuCategoryFetchOptions): Promise<IMenuCategory | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.menuCategory.findUnique({ where: { id } });
  }

  async findByName(restaurantId: string, name: string, options?: MenuCategoryFetchOptions): Promise<IMenuCategory | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.menuCategory.findUnique({ where: { restaurantId_name: { restaurantId, name } } });
  }

  async create(data: IMenuCategoryCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IMenuCategory> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.menuCategory.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IMenuCategoryUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IMenuCategory> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.menuCategory.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async delete(id: string, transaction?: PrismaTransaction): Promise<void> {
    const prisma = transaction ?? this.prisma;
    await prisma.menuCategory.delete({ where: { id } });
  }

  async countDishes(categoryId: string, options?: MenuCategoryFetchOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.count({ where: { categoryId } });
  }

  async fetchAll(query: IMenuCategoriesFetchQuery, options?: IMenuCategoriesFetchOptions): Promise<PaginatedResponse<IMenuCategory>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "sortOrder">(options ?? {});

    const where: Prisma.MenuCategoryWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" } }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.menuCategory.findMany({
            where,
            ...paginationQuery,
            orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }],
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.menuCategory.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }
}

export default MenuCategoryRepositoryImpl;
