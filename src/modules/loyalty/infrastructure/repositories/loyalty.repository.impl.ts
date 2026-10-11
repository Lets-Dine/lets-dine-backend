import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { LoyaltyEntryType, OrderStatus } from "@prisma/client";
import { ILoyaltyCustomer, ILoyaltyEntry, ILoyaltyOrder, ILoyaltyProgram } from "../../domain/interfaces/loyalty.interface";
import { ILoyaltyEntryCreate, ILoyaltyOptions, LoyaltyRepository } from "../../domain/repositories/loyalty.repository";

const ENTRY_SELECT = { id: true, type: true, points: true, paymentId: true, note: true, createdAt: true, createdByName: true } as const;
const PROGRAM_SELECT = { enabled: true, spendPerPoint: true, redeemValue: true, maxRedeemPct: true, reviewBonus: true } as const;

@Injectable()
class LoyaltyRepositoryImpl implements LoyaltyRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findProgram(restaurantId: string, options?: ILoyaltyOptions): Promise<ILoyaltyProgram | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.loyaltyProgram.findUnique({ where: { restaurantId }, select: PROGRAM_SELECT });
  }

  async upsertProgram(restaurantId: string, data: ILoyaltyProgram, updatedBy: string, options?: ILoyaltyOptions): Promise<ILoyaltyProgram> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.loyaltyProgram.upsert({
      where: { restaurantId },
      create: { restaurantId, ...data, updatedBy },
      update: { ...data, updatedBy },
      select: PROGRAM_SELECT,
    });
  }

  async createEntry(data: ILoyaltyEntryCreate, options?: ILoyaltyOptions): Promise<ILoyaltyEntry> {
    const prisma = options?.tx ?? this.prisma;
    if (!data.paymentId) return prisma.loyaltyEntry.create({ data, select: ENTRY_SELECT });
    // Settlement can be retried; the bill earns once. `update: {}` leaves the first line untouched.
    return prisma.loyaltyEntry.upsert({
      where: { paymentId_type: { paymentId: data.paymentId, type: data.type } },
      create: data,
      update: {},
      select: ENTRY_SELECT,
    });
  }

  async lockLedger(restaurantId: string, customerId: string, options: { tx: PrismaTransaction }): Promise<void> {
    await options.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${restaurantId}), hashtext(${customerId}))`;
  }

  async getBalance(restaurantId: string, customerId: string, options?: ILoyaltyOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const sum = await prisma.loyaltyEntry.aggregate({ where: { restaurantId, customerId }, _sum: { points: true } });
    return sum._sum.points ?? 0;
  }

  async fetchEntries(
    restaurantId: string,
    customerId: string,
    page: { limit: number; offset: number },
    options?: ILoyaltyOptions
  ): Promise<{ rows: ILoyaltyEntry[]; count: number }> {
    const prisma = options?.tx ?? this.prisma;
    const where = { restaurantId, customerId };
    const [rows, count] = await Promise.all([
      prisma.loyaltyEntry.findMany({ where, select: ENTRY_SELECT, orderBy: { createdAt: "desc" }, take: page.limit, skip: page.offset }),
      prisma.loyaltyEntry.count({ where }),
    ]);
    return { rows, count };
  }

  async findOrder(orderId: string, options?: ILoyaltyOptions): Promise<ILoyaltyOrder | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        restaurantId: true,
        sessionId: true,
        customerId: true,
        floorId: true,
        orderType: true,
        subtotal: true,
        discount: true,
        paidAt: true,
      },
    });
  }

  async sumVisitEarnableBase(sessionId: string, options?: ILoyaltyOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const sum = await prisma.order.aggregate({
      where: { sessionId, status: { not: OrderStatus.CANCELLED } },
      _sum: { subtotal: true, discount: true },
    });
    return (sum._sum.subtotal ?? 0) - (sum._sum.discount ?? 0);
  }

  async hasSessionPayment(sessionId: string, options?: ILoyaltyOptions): Promise<boolean> {
    const prisma = options?.tx ?? this.prisma;
    return (await prisma.payment.count({ where: { sessionId } })) > 0;
  }

  async hasOrderEntry(orderId: string, type: LoyaltyEntryType, options?: ILoyaltyOptions): Promise<boolean> {
    const prisma = options?.tx ?? this.prisma;
    return (await prisma.loyaltyEntry.count({ where: { orderId, type } })) > 0;
  }

  async sumEarnedForOrder(orderId: string, options?: ILoyaltyOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const sum = await prisma.loyaltyEntry.aggregate({ where: { orderId, type: LoyaltyEntryType.EARN }, _sum: { points: true } });
    return sum._sum.points ?? 0;
  }

  async sumEarnedForSession(sessionId: string, customerId: string, options?: ILoyaltyOptions): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const sum = await prisma.loyaltyEntry.aggregate({
      where: { customerId, type: LoyaltyEntryType.EARN, payment: { sessionId } },
      _sum: { points: true },
    });
    return sum._sum.points ?? 0;
  }

  async findCustomer(restaurantId: string, customerId: string, options?: ILoyaltyOptions): Promise<ILoyaltyCustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    const link = await prisma.customerRestaurant.findUnique({
      where: { customerId_restaurantId: { customerId, restaurantId } },
      select: { customer: { select: { id: true, name: true, phone: true } } },
    });
    return link?.customer ?? null;
  }
}

export default LoyaltyRepositoryImpl;
