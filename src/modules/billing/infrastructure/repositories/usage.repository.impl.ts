import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import { UsageRepository } from "../../domain/repositories/usage.repository";

/**
 * Branch and seat usage is derived from the live rows, so it can never drift from
 * reality. Only orders get a counter — that table grows too fast to COUNT on every order.
 */
@Injectable()
class UsageRepositoryImpl implements UsageRepository {
  constructor(private prisma: PrismaService) {}

  countActiveBranches(restaurantId: string): Promise<number> {
    return this.prisma.branch.count({ where: { restaurantId, isActive: true } });
  }

  countActiveSeats(restaurantId: string): Promise<number> {
    return this.prisma.restaurantMember.count({ where: { restaurantId, isActive: true } });
  }

  async getOrderCount(restaurantId: string, periodStart: Date): Promise<number> {
    const counter = await this.prisma.usageCounter.findUnique({
      where: { restaurantId_periodStart: { restaurantId, periodStart } },
      select: { orders: true },
    });
    return counter?.orders ?? 0;
  }

  async incrementOrderCount(restaurantId: string, periodStart: Date): Promise<number> {
    const counter = await this.prisma.usageCounter.upsert({
      where: { restaurantId_periodStart: { restaurantId, periodStart } },
      create: { restaurantId, periodStart, orders: 1 },
      update: { orders: { increment: 1 } },
      select: { orders: true },
    });
    return counter.orders;
  }
}

export default UsageRepositoryImpl;
