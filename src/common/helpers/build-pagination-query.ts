import { IPaginationOptions } from "../interfaces/pagination.interface";

interface PrismaPaginationQuery<T extends string> {
  skip?: number;
  take?: number;
  orderBy?: Partial<Record<T, "asc" | "desc">>;
}

/**
 * Turns the shared pagination options into a Prisma `findMany` clause. A missing
 * or zero `limit` means "no pagination" — skip/take are then left off entirely.
 */
export function buildPaginationQuery<T extends string>(options: IPaginationOptions): PrismaPaginationQuery<T> {
  const query: PrismaPaginationQuery<T> = {};

  if (options.limit) {
    query.take = options.limit;
    query.skip = options.offset ?? 0;
  }

  if (options.sortBy) {
    query.orderBy = { [options.sortBy]: options.sortOrder ?? "asc" } as Partial<Record<T, "asc" | "desc">>;
  }

  return query;
}
