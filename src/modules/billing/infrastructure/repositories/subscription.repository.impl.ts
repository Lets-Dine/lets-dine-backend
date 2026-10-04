import { Injectable } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IBillingSubscription, ILifecycleSubscription, ISubscriptionDetail } from "../../domain/interfaces/billing.interface";
import {
  ISubscriptionOptions,
  ISubscriptionTrialCreate,
  ISubscriptionUpdate,
  SubscriptionRepository,
} from "../../domain/repositories/subscription.repository";

const DETAIL_INCLUDE = { plan: true, pendingPlan: true } as const;

@Injectable()
class SubscriptionRepositoryImpl implements SubscriptionRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findByRestaurantId(restaurantId: string): Promise<IBillingSubscription | null> {
    return this.prisma.subscription.findUnique({
      where: { restaurantId },
      select: {
        id: true,
        restaurantId: true,
        status: true,
        trialEndsAt: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        pastDueSince: true,
        extraBranches: true,
        extraSeats: true,
        plan: { select: { id: true, key: true, limits: true, features: true } },
      },
    });
  }

  async findStatusByRestaurantId(restaurantId: string): Promise<SubscriptionStatus | null> {
    const row = await this.prisma.subscription.findUnique({ where: { restaurantId }, select: { status: true } });
    return row?.status ?? null;
  }

  findDetailByRestaurantId(restaurantId: string, options?: ISubscriptionOptions): Promise<ISubscriptionDetail | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.subscription.findUnique({ where: { restaurantId }, include: DETAIL_INCLUDE });
  }

  findDetailById(id: string, options?: ISubscriptionOptions): Promise<ISubscriptionDetail | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.subscription.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  }

  findDueForInvoicing(periodEndBy: Date): Promise<ISubscriptionDetail[]> {
    return this.prisma.subscription.findMany({
      where: {
        status: { not: "CANCELLED" },
        currentPeriodEnd: { lte: periodEndBy },
        invoices: { none: { status: "OPEN" } },
      },
      include: DETAIL_INCLUDE,
      orderBy: { currentPeriodEnd: "asc" },
    });
  }

  findAllLive(): Promise<ILifecycleSubscription[]> {
    return this.prisma.subscription.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, restaurantId: true, status: true, trialEndsAt: true, currentPeriodEnd: true, pastDueSince: true },
    });
  }

  async update(id: string, data: ISubscriptionUpdate, options?: ISubscriptionOptions): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.subscription.update({ where: { id }, data });
  }

  async createTrial(data: ISubscriptionTrialCreate, options?: ISubscriptionOptions): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    const plan = await prisma.plan.findUnique({ where: { key: data.planKey }, select: { id: true } });
    if (!plan) throw new Error(`Cannot start a trial: plan "${data.planKey}" does not exist`);

    await prisma.subscription.create({
      data: {
        restaurantId: data.restaurantId,
        planId: plan.id,
        status: "TRIAL",
        trialEndsAt: data.trialEnd,
        currentPeriodStart: data.trialStart,
        currentPeriodEnd: data.trialEnd,
      },
    });
  }
}

export default SubscriptionRepositoryImpl;
