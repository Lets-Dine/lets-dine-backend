import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPlan } from "../../domain/interfaces/billing.interface";
import { IPlanOptions, IPlanUpdate, PlanRepository } from "../../domain/repositories/plan.repository";

@Injectable()
class PlanRepositoryImpl implements PlanRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findByKey(key: string): Promise<IPlan | null> {
    return this.prisma.plan.findUnique({ where: { key } });
  }

  findSelfServe(): Promise<IPlan[]> {
    return this.prisma.plan.findMany({
      where: { isPublic: true, isActive: true, type: "SUBSCRIPTION" },
      orderBy: { monthlyPrice: "asc" },
    });
  }

  findAllActive(options: IPlanOptions = {}): Promise<IPlan[]> {
    return (options.tx ?? this.prisma).plan.findMany({ where: { isActive: true }, orderBy: [{ monthlyPrice: "asc" }, { key: "asc" }] });
  }

  async countRestaurantsByPlanKey(options: IPlanOptions = {}): Promise<Record<string, number>> {
    const client = options.tx ?? this.prisma;
    const [groups, plans] = await Promise.all([
      client.subscription.groupBy({ by: ["planId"], where: { status: { not: "CANCELLED" } }, _count: { _all: true } }),
      client.plan.findMany({ select: { id: true, key: true } }),
    ]);
    const keyById = new Map(plans.map(plan => [plan.id, plan.key]));
    const counts: Record<string, number> = {};
    for (const group of groups) {
      const key = keyById.get(group.planId);
      if (key) counts[key] = group._count._all;
    }
    return counts;
  }

  async updateByKey(key: string, data: IPlanUpdate, options: IPlanOptions = {}): Promise<void> {
    await (options.tx ?? this.prisma).plan.update({ where: { key }, data });
  }
}

export default PlanRepositoryImpl;
