export type SortOrder = "asc" | "desc";

/**
 * The one list envelope the whole API uses — `{ rows, count }`, never
 * `{ items, total }`. `count` is `-1` when the caller opted out of it with
 * `returnCount=false`.
 */
export interface PaginatedResponse<T> {
  rows: T[];
  count: number;
}

export interface IPaginationOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  returnData?: boolean;
  returnCount?: boolean;
}
