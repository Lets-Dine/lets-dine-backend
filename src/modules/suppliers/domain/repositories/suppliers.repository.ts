import { PaymentMethod, SupplierIssueKind } from "@prisma/client";
import { IOtherPrice } from "../utils/supplier-prices.util";
import { IDelivery, IIssue, IReturn, INamedStats, IPayment, ISupplierRecord } from "../interfaces/suppliers.interface";

export interface IPaymentCreate {
  restaurantId: string;
  branchId: string;
  supplier: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  createdBy: string;
  createdByName: string;
}

export abstract class SuppliersRepository {
  abstract findSuppliers(restaurantId: string): Promise<ISupplierRecord[]>;
  abstract findSupplier(id: string, restaurantId: string): Promise<ISupplierRecord | null>;
  /** Matched without regard to case. */
  abstract findSupplierByName(restaurantId: string, name: string): Promise<ISupplierRecord | null>;
  abstract createSupplier(data: { restaurantId: string; name: string; phone: string; note: string; createdBy: string }): Promise<ISupplierRecord>;
  abstract updateSupplier(id: string, data: Partial<Pick<ISupplierRecord, "phone" | "note" | "isArchived">>): Promise<ISupplierRecord>;
  /** Every supplier this branch's deliveries mention, keyed by lower-cased name. Transferred-in stock is not a delivery. */
  abstract findDeliveryStats(branchId: string): Promise<Map<string, INamedStats>>;
  /** Total paid to each supplier by this branch, keyed by lower-cased name. */
  abstract findPaidTotals(branchId: string): Promise<Map<string, number>>;
  /** Deliveries from one supplier, newest first. */
  abstract findDeliveries(branchId: string, supplier: string, limit: number, offset?: number): Promise<IDelivery[]>;
  /** Each other supplier's latest priced delivery of these ingredients in this branch, so prices can be compared. */
  abstract findOtherPrices(branchId: string, ingredientIds: string[], excludeSupplier: string): Promise<IOtherPrice[]>;
  /** Stock this branch sent back to one supplier, newest first. */
  abstract findReturns(branchId: string, supplier: string, limit: number): Promise<IReturn[]>;
  abstract findPayments(branchId: string, supplier: string, limit: number): Promise<IPayment[]>;
  /** Records the payment and books it in the cash book, together. */
  abstract createPayment(data: IPaymentCreate): Promise<IPayment>;
  abstract findIssues(restaurantId: string, supplier: string, limit: number): Promise<IIssue[]>;
  abstract countIssues(restaurantId: string, supplier: string): Promise<Partial<Record<SupplierIssueKind, number>>>;
  abstract createIssue(data: {
    restaurantId: string;
    supplier: string;
    kind: SupplierIssueKind;
    note: string;
    createdBy: string;
    createdByName: string;
  }): Promise<IIssue>;
}
