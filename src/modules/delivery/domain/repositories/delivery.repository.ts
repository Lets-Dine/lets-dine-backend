import {
  DeliveryAccountKind,
  DeliveryFeeModel,
  DeliveryRiderKind,
  DeliveryRiderPayModel,
  DeliverySettlementDirection,
  DeliverySettlementMethod,
} from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IAccountTotals } from "../utils/delivery-balance.util";
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
} from "../interfaces/delivery.interface";

export interface IDeliveryScope {
  restaurantId: string;
  branchId: string;
}

export interface IPartnerWrite {
  name: string;
  phone: string;
  contactPerson: string;
  note: string;
  feeModel: DeliveryFeeModel;
  feeValue: number;
  collectsCash: boolean;
  isActive?: boolean;
}

export interface IRiderWrite {
  name: string;
  phone: string;
  kind: DeliveryRiderKind;
  partnerId: string | null;
  vehicle: string;
  note: string;
  payModel: DeliveryRiderPayModel;
  payValue: number;
  isActive?: boolean;
}

export interface IAssignmentCreate extends IDeliveryScope {
  orderId: string;
  orderRef: string;
  customerName: string;
  orderTotal: number;
  riderId: string | null;
  partnerId: string | null;
  riderName: string | null;
  partnerName: string | null;
  accountKind: DeliveryAccountKind;
  accountId: string;
  courierFee: number;
  cashToCollect: number;
  createdBy: string;
}

export interface ISettlementCreate extends IDeliveryScope {
  accountKind: DeliveryAccountKind;
  accountId: string;
  /** Set when the money was settled as part of settling one delivery order. */
  orderId?: string;
  direction: DeliverySettlementDirection;
  amount: number;
  offset: number;
  method: DeliverySettlementMethod;
  note: string;
  createdBy: string;
  createdByName: string;
}

export type CourierKind = "PARTNER" | "RIDER";

/** Where a statement page starts: just older than this entry. */
export interface IStatementCursor {
  at: Date;
  /** Deliveries sort before settlements at the same instant. */
  rank: number;
  id: string;
}

export abstract class DeliveryRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;

  /** What the dispatch sheet needs: active riders, every partner and open runs — no money history. */
  abstract fetchDispatchBook(scope: IDeliveryScope): Promise<IDeliveryBook>;

  /** The Delivery page: every courier with its balance, aggregated in the database. No runs, no settlements. */
  abstract fetchOverview(scope: IDeliveryScope): Promise<IDeliveryOverview>;
  /** One courier's header: balance, terms, who is out on the road. Null if it isn't in this branch. */
  abstract fetchCourierDetail(scope: IDeliveryScope, kind: CourierKind, id: string): Promise<IDeliveryCourierDetail | null>;
  /** One page of a courier's statement, newest first. Null if the courier isn't in this branch. */
  abstract fetchStatement(
    scope: IDeliveryScope,
    kind: CourierKind,
    id: string,
    options: { limit: number; cursor?: IStatementCursor }
  ): Promise<IStatementPage | null>;

  abstract findPartner(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryPartner | null>;
  abstract createPartner(scope: IDeliveryScope, data: IPartnerWrite, actorId: string): Promise<IDeliveryPartner>;
  abstract updatePartner(id: string, data: Partial<IPartnerWrite>, actorId: string): Promise<IDeliveryPartner>;

  abstract findRider(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryRider | null>;
  abstract createRider(scope: IDeliveryScope, data: IRiderWrite, actorId: string): Promise<IDeliveryRider>;
  abstract updateRider(id: string, data: Partial<IRiderWrite>, actorId: string): Promise<IDeliveryRider>;

  abstract findOrder(id: string, options?: { tx?: PrismaTransaction }): Promise<IDeliveryOrder | null>;
  /** The open run for an order, else its most recent one. */
  abstract findAssignmentForOrder(scope: IDeliveryScope, orderId: string): Promise<IDeliveryAssignment | null>;
  abstract findOpenAssignment(
    scope: IDeliveryScope,
    orderId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IDeliveryAssignment | null>;
  /** The latest delivered run for an order — whose courier it was and what came back. Null if it went out with no courier recorded. */
  abstract findDeliveredAssignment(
    scope: IDeliveryScope,
    orderId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IDeliveryAssignment | null>;
  abstract deleteOpenAssignments(scope: IDeliveryScope, orderId: string, options?: { tx?: PrismaTransaction }): Promise<void>;
  abstract createAssignment(data: IAssignmentCreate, options?: { tx?: PrismaTransaction }): Promise<IDeliveryAssignment>;
  abstract completeAssignment(id: string, cashCollected: number, actorId: string): Promise<IDeliveryAssignment>;

  abstract sumAccount(
    scope: IDeliveryScope,
    account: { kind: DeliveryAccountKind; id: string },
    options?: { tx?: PrismaTransaction }
  ): Promise<IAccountTotals>;
  abstract createSettlement(data: ISettlementCreate, options?: { tx?: PrismaTransaction }): Promise<IDeliverySettlement>;
}
