import { Injectable } from "@nestjs/common";
import { Prisma, StaffRole } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import {
  IRestaurantMemberCreate,
  IRestaurantMemberUpdate,
  IStaffMembersFetchOptions,
  IStaffMembersFetchQuery,
  RestaurantMemberFetchOptions,
  RestaurantMemberRepository,
} from "../../domain/repositories/restaurant-member.repository";

type MemberWithUser = Prisma.RestaurantMemberGetPayload<{ include: { user: true } }>;

@Injectable()
class RestaurantMemberRepositoryImpl implements RestaurantMemberRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: RestaurantMemberFetchOptions): Promise<IStaffMember | null> {
    const prisma = options?.tx ?? this.prisma;
    const member = await prisma.restaurantMember.findUnique({ where: { id }, include: { user: true } });
    return member ? this.toStaffMember(member) : null;
  }

  async findByUserAndRestaurant(
    userId: string,
    restaurantId: string,
    options?: RestaurantMemberFetchOptions
  ): Promise<IStaffMember | null> {
    const prisma = options?.tx ?? this.prisma;
    const member = await prisma.restaurantMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } },
      include: { user: true },
    });
    return member ? this.toStaffMember(member) : null;
  }

  async findActiveByUserId(userId: string, options?: RestaurantMemberFetchOptions): Promise<IStaffMember[]> {
    const prisma = options?.tx ?? this.prisma;
    const members = await prisma.restaurantMember.findMany({
      where: { userId, isActive: true },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map(member => this.toStaffMember(member));
  }

  async countActiveByRole(restaurantId: string, role: StaffRole, options?: RestaurantMemberFetchOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.restaurantMember.count({ where: { restaurantId, role, isActive: true } });
  }

  async create(data: IRestaurantMemberCreate, options?: { tx?: PrismaTransaction }): Promise<IStaffMember> {
    const prisma = options?.tx ?? this.prisma;
    const member = await prisma.restaurantMember.create({ data, include: { user: true } });
    return this.toStaffMember(member);
  }

  async update(id: string, data: IRestaurantMemberUpdate, transaction?: PrismaTransaction): Promise<IStaffMember> {
    const prisma = transaction ?? this.prisma;
    const member = await prisma.restaurantMember.update({ where: { id }, data, include: { user: true } });
    return this.toStaffMember(member);
  }

  async fetchAll(query: IStaffMembersFetchQuery, options?: IStaffMembersFetchOptions): Promise<PaginatedResponse<IStaffMember>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt" | "role">(options ?? {});

    const where: Prisma.RestaurantMemberWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.role && { role: query.role }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.keyword && {
        user: {
          OR: [
            { name: { contains: query.keyword, mode: "insensitive" as const } },
            { email: { contains: query.keyword, mode: "insensitive" as const } },
          ],
        },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.restaurantMember.findMany({
            where,
            include: { user: true },
            ...paginationQuery,
            orderBy: orderBy ?? { createdAt: "asc" },
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.restaurantMember.count({ where }),
    ]);

    return { rows: rows.map(member => this.toStaffMember(member)), count: count ?? 0 };
  }

  private toStaffMember(member: MemberWithUser): IStaffMember {
    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      isActive: member.isActive,
      name: member.user.name,
      email: member.user.email,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}

export default RestaurantMemberRepositoryImpl;
