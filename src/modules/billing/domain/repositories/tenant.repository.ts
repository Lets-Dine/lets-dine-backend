import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { ITenantListItem, ITenantViewCounts } from "../interfaces/billing.interface";

export type TenantView = "all" | "active" | "trial" | "attention" | "closed";
export type TenantSort = "active" | "newest" | "name" | "revenue";

export interface ITenantsFetchQuery {
  view: TenantView;
  planKey?: string;
  keyword?: string;
}

/** Read-side only: the operator's cross-restaurant listing, built for one fast read rather than for reuse. */
export abstract class TenantRepository {
  abstract fetchAll(query: ITenantsFetchQuery, options?: IPaginationOptions): Promise<PaginatedResponse<ITenantListItem>>;
  abstract countByView(): Promise<ITenantViewCounts>;
}
