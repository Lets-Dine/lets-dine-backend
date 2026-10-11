import { Injectable } from "@nestjs/common";
import { DeliveryAccountKind, DeliveryAssignmentStatus, DeliverySettlement, DeliverySettlementDirection } from "@prisma/client";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import {
  IDeliveryAssignment,
  IDeliveryBook,
  IDeliveryCourierDetail,
  IDeliveryOrder,
  IDeliveryOverview,
  IDeliveryPartner,
  IDeliveryRider,
  IDeliverySettlement,
  IStatementPage,
} from "../../domain/interfaces/delivery.interface";
import {
  CourierKind,
  DeliveryRepository,
  IAssignmentCreate,
  IDeliveryScope,
  IPartnerWrite,
  IRiderWrite,
  ISettlementCreate,
  IStatementCursor,
} from "../../domain/repositories/delivery.repository";
import { IAccountTotals } from "../../domain/utils/delivery-balance.util";
import * as queries from "./delivery.queries";

/** The dashboard reads a settlement's time as `at`; the column is the usual `createdAt`. */
const toSettlement = ({ createdAt, createdBy: _by, createdByName: _name, ...rest }: DeliverySettlement): IDeliverySettlement => ({
  ...rest,
  at: createdAt,
});

const ASSIGNMENT_ORDER = { assignedAt: "desc" } as const;

@Injectable()
class DeliveryRepositoryImpl implements DeliveryRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async fetchDispatchBook(scope: IDeliveryScope): Promise<IDeliveryBook> {
    const [partners, riders, assignments] = await Promise.all([
      // Paused partners stay in the dispatch view: an active rider under one still needs their terms. The picker hides them.
      this.prisma.deliveryPartner.findMany({ where: scope, orderBy: { createdAt: "asc" } }),
      this.prisma.deliveryRider.findMany({ where: { ...scope, isActive: true }, orderBy: { createdAt: "asc" } }),
      this.prisma.deliveryAssignment.findMany({
        where: { ...scope, status: DeliveryAssignmentStatus.ASSIGNED },
        orderBy: ASSIGNMENT_ORDER,
      }),
    ]);
    return { partners, riders, assignments, settlements: [] };
  }

  async fetchOverview(scope: IDeliveryScope): Promise<IDeliveryOverview> {
    return queries.fetchOverview(this.prisma, scope);
  }

  async fetchCourierDetail(scope: IDeliveryScope, kind: CourierKind, id: string): Promise<IDeliveryCourierDetail | null> {
    return queries.fetchCourierDetail(this.prisma, scope, kind, id);
  }

  async fetchStatement(
    scope: IDeliveryScope,
    kind: CourierKind,
    id: string,
    options: { limit: number; cursor?: IStatementCursor }
  ): Promise<IStatementPage | null> {
    return queries.fetchStatement(this.prisma, scope, kind, id, options);
  }

  async findPartner(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryPartner | null> {
    return (options?.tx ?? this.prisma).deliveryPartner.findUnique({ where: { id } });
  }

  async createPartner(scope: IDeliveryScope, data: IPartnerWrite, actorId: string): Promise<IDeliveryPartner> {
    return this.prisma.deliveryPartner.create({ data: { ...scope, ...data, createdBy: actorId, updatedBy: actorId } });
  }

  async updatePartner(id: string, data: Partial<IPartnerWrite>, actorId: string): Promise<IDeliveryPartner> {
    return this.prisma.deliveryPartner.update({ where: { id }, data: { ...data, updatedBy: actorId } });
  }

  async findRider(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryRider | null> {
    return (options?.tx ?? this.prisma).deliveryRider.findUnique({ where: { id } });
  }

  async createRider(scope: IDeliveryScope, data: IRiderWrite, actorId: string): Promise<IDeliveryRider> {
    return this.prisma.deliveryRider.create({ data: { ...scope, ...data, createdBy: actorId, updatedBy: actorId } });
  }

  async updateRider(id: string, data: Partial<IRiderWrite>, actorId: string): Promise<IDeliveryRider> {
    return this.prisma.deliveryRider.update({ where: { id }, data: { ...data, updatedBy: actorId } });
  }

  async findOrder(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryOrder | null> {
    return (options?.tx ?? this.prisma).order.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        restaurantId: true,
        branchId: true,
        orderType: true,
        status: true,
        total: true,
        deliveryCustomerName: true,
      },
    });
  }

  async findAssignmentForOrder(scope: IDeliveryScope, orderId: string): Promise<IDeliveryAssignment | null> {
    const runs = await this.prisma.deliveryAssignment.findMany({ where: { ...scope, orderId }, orderBy: ASSIGNMENT_ORDER });
    return runs.find(run => run.status === DeliveryAssignmentStatus.ASSIGNED) ?? runs[0] ?? null;
  }

  async findOpenAssignment(
    scope: IDeliveryScope,
    orderId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IDeliveryAssignment | null> {
    return (options?.tx ?? this.prisma).deliveryAssignment.findFirst({
      where: { ...scope, orderId, status: DeliveryAssignmentStatus.ASSIGNED },
      orderBy: ASSIGNMENT_ORDER,
    });
  }

  async findDeliveredAssignment(
    scope: IDeliveryScope,
    orderId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IDeliveryAssignment | null> {
    return (options?.tx ?? this.prisma).deliveryAssignment.findFirst({
      where: { ...scope, orderId, status: DeliveryAssignmentStatus.DELIVERED },
      orderBy: { deliveredAt: "desc" },
    });
  }

  async deleteOpenAssignments(scope: IDeliveryScope, orderId: string, options?: { tx?: PrismaTransaction }): Promise<void> {
    await (options?.tx ?? this.prisma).deliveryAssignment.deleteMany({
      where: { ...scope, orderId, status: DeliveryAssignmentStatus.ASSIGNED },
    });
  }

  async createAssignment(data: IAssignmentCreate, options?: { tx?: PrismaTransaction }): Promise<IDeliveryAssignment> {
    return (options?.tx ?? this.prisma).deliveryAssignment.create({ data: { ...data, updatedBy: data.createdBy } });
  }

  async completeAssignment(id: string, cashCollected: number, actorId: string): Promise<IDeliveryAssignment> {
    return this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status: DeliveryAssignmentStatus.DELIVERED, deliveredAt: new Date(), cashCollected, updatedBy: actorId },
    });
  }

  async sumAccount(
    scope: IDeliveryScope,
    account: { kind: DeliveryAccountKind; id: string },
    options?: { tx?: PrismaTransaction }
  ): Promise<IAccountTotals> {
    const prisma = options?.tx ?? this.prisma;
    const where = { ...scope, accountKind: account.kind, accountId: account.id };
    const [runs, settled] = await Promise.all([
      prisma.deliveryAssignment.aggregate({
        where: { ...where, status: DeliveryAssignmentStatus.DELIVERED },
        _sum: { cashCollected: true, courierFee: true },
      }),
      prisma.deliverySettlement.groupBy({ by: ["direction"], where, _sum: { amount: true, offset: true } }),
    ]);
    const sumOf = (direction: DeliverySettlementDirection) => settled.find(row => row.direction === direction)?._sum.amount ?? 0;
    return {
      cashCollected: runs._sum.cashCollected ?? 0,
      feesEarned: runs._sum.courierFee ?? 0,
      collected: sumOf(DeliverySettlementDirection.COLLECT),
      paidOut: sumOf(DeliverySettlementDirection.PAYOUT),
      offsets: settled.reduce((sum, row) => sum + (row._sum.offset ?? 0), 0),
    };
  }

  async createSettlement(data: ISettlementCreate, options?: { tx?: PrismaTransaction }): Promise<IDeliverySettlement> {
    return toSettlement(await (options?.tx ?? this.prisma).deliverySettlement.create({ data }));
  }
}

export default DeliveryRepositoryImpl;
