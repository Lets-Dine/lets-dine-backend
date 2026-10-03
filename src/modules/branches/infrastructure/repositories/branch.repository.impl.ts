import { Injectable } from "@nestjs/common";
import { Prisma, StaffRole } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IBranch, IBranchHours, IBranchWithHours } from "../../domain/interfaces/branch.interface";
import {
  BranchFetchOptions,
  BranchRepository,
  IBranchCreate,
  IBranchesFetchOptions,
  IBranchesFetchQuery,
  IBranchHoursInput,
  IBranchUpdate,
} from "../../domain/repositories/branch.repository";

@Injectable()
class BranchRepositoryImpl implements BranchRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: BranchFetchOptions): Promise<IBranchWithHours | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findUnique({
      where: { id },
      include: { hours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] } },
    });
  }

  async findBySlug(restaurantId: string, slug: string, options?: BranchFetchOptions): Promise<IBranch | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } });
  }

  async findAccessible(member: { id: string; restaurantId: string; role: StaffRole }, options?: BranchFetchOptions): Promise<IBranch[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findMany({
      where: {
        restaurantId: member.restaurantId,
        isActive: true,
        ...(member.role !== StaffRole.OWNER && { members: { some: { memberId: member.id } } }),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findActiveByIds(restaurantId: string, ids: string[], options?: BranchFetchOptions): Promise<IBranch[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findMany({ where: { restaurantId, isActive: true, id: { in: ids } } });
  }

  async findActiveWithHours(restaurantId: string, options?: BranchFetchOptions): Promise<IBranchWithHours[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findMany({
      where: { restaurantId, isActive: true },
      include: { hours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findDefault(restaurantId: string, options?: BranchFetchOptions): Promise<IBranch | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.findFirst({ where: { restaurantId, isDefault: true } });
  }

  async create(data: IBranchCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IBranch> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IBranchUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IBranch> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.branch.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IBranchesFetchQuery, options?: IBranchesFetchOptions): Promise<PaginatedResponse<IBranch>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "createdAt">(options ?? {});

    const where: Prisma.BranchWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.branchIds && { id: { in: query.branchIds } }),
      ...(query.keyword && { name: { contains: query.keyword, mode: "insensitive" } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.branch.findMany({ where, ...paginationQuery, orderBy: orderBy ?? [{ isDefault: "desc" }, { name: "asc" }] }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.branch.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }

  async replaceHours(branchId: string, hours: IBranchHoursInput[], options?: { tx?: PrismaTransaction }): Promise<IBranchHours[]> {
    const run = async (prisma: PrismaTransaction): Promise<IBranchHours[]> => {
      await prisma.branchHours.deleteMany({ where: { branchId } });
      await prisma.branchHours.createMany({ data: hours.map(entry => ({ ...entry, branchId })) });
      return prisma.branchHours.findMany({ where: { branchId }, orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] });
    };

    if (options?.tx) return run(options.tx);
    return this.prisma.$transaction(tx => run(tx as PrismaTransaction));
  }
}

export default BranchRepositoryImpl;
