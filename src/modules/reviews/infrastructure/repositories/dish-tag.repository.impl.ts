import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDishTag } from "../../domain/interfaces/dish-tag.interface";
import { DishTagRepository } from "../../domain/repositories/dish-tag.repository";

@Injectable()
class DishTagRepositoryImpl implements DishTagRepository {
  constructor(private prisma: PrismaService) {}

  async fetchActive(options?: { tx?: PrismaTransaction }): Promise<IDishTag[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishTag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, isActive: true, sortOrder: true },
    });
  }

  async findByLabels(labels: string[], options?: { tx?: PrismaTransaction }): Promise<IDishTag[]> {
    if (labels.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    return prisma.dishTag.findMany({
      where: { label: { in: labels }, isActive: true },
      select: { id: true, label: true, isActive: true, sortOrder: true },
    });
  }
}

export default DishTagRepositoryImpl;
