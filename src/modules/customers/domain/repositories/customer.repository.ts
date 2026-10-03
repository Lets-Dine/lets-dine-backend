import { PrismaTransaction } from "../../../../common/prisma";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { CustomerSegment, ICustomer, ICustomerListItem } from "../interfaces/customer.interface";

export interface ICustomerUpsert {
  restaurantId: string;
  phone: string;
  name: string;
  defaultAddress?: string | null;
  defaultNote?: string | null;
}

export interface ICustomersFetchQuery {
  restaurantId: string;
  branchId: string;
  /** Name fragment or part of a phone number. */
  q?: string;
  /** `occasional` isn't filterable — it's just "none of the above". */
  segment?: Exclude<CustomerSegment, "occasional">;
}

export interface CustomerFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class CustomerRepository {
  /** `restaurantId` resolves which restaurant's own defaults come back on the returned `ICustomer` — the global `Customer` row itself is shared across all of them. */
  abstract findById(id: string, restaurantId: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  /** Keyed by `(restaurantId, phone)` — the diner's whole identity, for delivery or a floor order. */
  abstract findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null>;
  /** The dashboard's customers list for one branch — every customer the restaurant knows, with figures from this branch's payments — see the impl. `sortBy` is one of `CUSTOMER_SORT_KEYS`. */
  abstract fetchAll(query: ICustomersFetchQuery, options?: IPaginationOptions): Promise<PaginatedResponse<ICustomerListItem>>;
  abstract upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer>;
}
