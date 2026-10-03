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
  /** `restaurantId` resolves which restaurant's own defaults come back on the returned `ICustomer` — the global `Customer` row itself is shared across all of them. */
  abstract findById(id: string, restaurantId: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  /** Keyed by `(restaurantId, phone)` — the diner's whole identity, for delivery or a floor order. */
  abstract findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  abstract upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer>;
}
