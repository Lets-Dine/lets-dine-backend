import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import {
  DishVariantFetchOptions,
  DishVariantRepository,
  IDishVariantCreate,
  IDishVariantUpdate,
} from "../../domain/repositories/dish-variant.repository";

@Injectable()
class DishVariantRepositoryImpl implements DishVariantRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IDishVariant | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishVariant.findUnique({ where: { id } });
  }

  async findByDishId(dishId: string, options?: DishVariantFetchOptions): Promise<IDishVariant[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishVariant.findMany({
      where: { dishId, ...(options?.isArchived !== undefined && { isArchived: options.isArchived }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findManyByDishIds(dishIds: string[], options?: DishVariantFetchOptions): Promise<Record<string, IDishVariant[]>> {
    if (dishIds.length === 0) return {};
    const prisma = options?.tx ?? this.prisma;
    const rows = await prisma.dishVariant.findMany({
      where: { dishId: { in: dishIds }, ...(options?.isArchived !== undefined && { isArchived: options.isArchived }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const byDish: Record<string, IDishVariant[]> = {};
    for (const row of rows) {
      if (!byDish[row.dishId]) byDish[row.dishId] = [];
      byDish[row.dishId].push(row);
    }
    return byDish;
  }

  async create(data: IDishVariantCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDishVariant> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishVariant.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IDishVariantUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDishVariant> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishVariant.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }
}

export default DishVariantRepositoryImpl;
