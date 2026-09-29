import { PrismaTransaction } from "../../../../common/prisma";
import { ICustomer } from "../interfaces/customer.interface";

export interface ICustomerUpsert {
  restaurantId: string;
  phone: string;
  name: string;
  defaultAddress?: string | null;
  defaultNote?: string | null;
}

export interface CustomerFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class CustomerRepository {
  abstract findById(id: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  /** Keyed by `(restaurantId, phone)` — the diner's whole identity for delivery. */
  abstract findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  abstract upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer>;
}
