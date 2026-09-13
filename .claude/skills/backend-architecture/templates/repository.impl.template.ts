// infrastructure/repositories/{feature-name}.repository.impl.ts
import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@holista/db";
import { buildPaginationQuery } from "@holista/core/helpers";
import { I{Feature}, PaginatedResponse } from "@holista/core/interfaces";
import { PrismaService } from "../../../../../shared/infrastructure/prisma.service";
import {
  I{Feature}Create,
  I{Feature}Update,
  I{Feature}sFetchOptions,
  I{Feature}sFetchQuery,
  {Feature}FetchOptions,
  {Feature}Repository,
} from "../../domain/repositories/{feature-name}.repository";

@Injectable()
class {Feature}RepositoryImpl implements {Feature}Repository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: number, options?: {Feature}FetchOptions): Promise<I{Feature} | null> {
    const prisma = options?.tx || this.prisma;
    const {feature} = await prisma.{feature}s.findUnique({ where: { id }, include: options?.include });
    return {feature} as I{Feature} | null;
  }

  async create(data: I{Feature}Create, options: { tx?: PrismaClient; authEntity: { sub?: number } }): Promise<I{Feature}> {
    const prisma = options.tx || this.prisma;
    const {feature} = await prisma.{feature}s.create({
      data: { ...data, createdBy: options.authEntity.sub, updatedBy: options.authEntity.sub },
    });
    return {feature} as I{Feature};
  }

  async update(id: number, data: I{Feature}Update, transaction?: PrismaClient): Promise<I{Feature}> {
    const prisma = transaction || this.prisma;
    const {feature} = await prisma.{feature}s.update({ where: { id }, data });
    return {feature} as I{Feature};
  }

  async delete(id: number, transaction?: PrismaClient): Promise<void> {
    const prisma = transaction || this.prisma;
    await prisma.{feature}s.delete({ where: { id } });
  }

  async fetchAll(query: I{Feature}sFetchQuery, options?: I{Feature}sFetchOptions): Promise<PaginatedResponse<I{Feature}>> {
    const prisma = options?.tx || this.prisma;
    const paginationQuery = buildPaginationQuery<keyof I{Feature}>(options ?? {});

    const where = {
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" as const } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, count] = await Promise.all([
      prisma.{feature}s.findMany({ where, ...paginationQuery }),
      prisma.{feature}s.count({ where }),
    ]);

    return { rows: data as I{Feature}[], count: count ?? 0 };
  }
}

export default {Feature}RepositoryImpl;
