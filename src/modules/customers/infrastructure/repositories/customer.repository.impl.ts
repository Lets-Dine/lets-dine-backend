import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService } from "../../../../common/prisma";
import type { PrismaTransaction } from "../../../../common/prisma";
import { normalizePhone } from "../../../../common/utils";
import { LAPSED_AFTER_DAYS, NEW_WITHIN_DAYS, REGULAR_MIN_VISITS, RHYTHM_WEEKS } from "../../domain/constants/segments";
import { CustomerSegment, ICustomer, ICustomerListItem } from "../../domain/interfaces/customer.interface";
import { CustomerFetchOptions, CustomerRepository, ICustomersFetchQuery, ICustomerUpsert } from "../../domain/repositories/customer.repository";

interface CustomerRestaurantWithCustomer {
  restaurantId: string;
  defaultAddress: string | null;
  defaultNote: string | null;
  customer: { id: string; phone: string; name: string; createdAt: Date; updatedAt: Date };
}

function toCustomer(link: CustomerRestaurantWithCustomer): ICustomer {
  return {
    id: link.customer.id,
    restaurantId: link.restaurantId,
    phone: link.customer.phone,
    name: link.customer.name,
    defaultAddress: link.defaultAddress,
    defaultNote: link.defaultNote,
    createdAt: link.customer.createdAt,
    updatedAt: link.customer.updatedAt,
  };
}

/** Whitelisted `ORDER BY` fragments — `sortBy` picks a key, user text never reaches the SQL. `id` breaks ties so paging is stable. */
const ORDER_BY: Record<string, { column: Prisma.Sql; defaultDir: "asc" | "desc" }> = {
  lastVisit: { column: Prisma.sql`last_visit_at`, defaultDir: "desc" },
  visits: { column: Prisma.sql`visits`, defaultDir: "desc" },
  spend: { column: Prisma.sql`spend`, defaultDir: "desc" },
  name: { column: Prisma.sql`lower(name)`, defaultDir: "asc" },
};

interface CustomerListRow {
  id: string;
  name: string;
  phone: string;
  segment: CustomerSegment;
  visits: number;
  lastVisitAt: Date | null;
  spend: number;
  joinedAt: Date;
  weeksAgo: number[] | null;
  total: number;
}

/** `%`, `_` and `\` are LIKE wildcards — a search for "50%" must not match everything. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

@Injectable()
class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, restaurantId: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    const link = await prisma.customerRestaurant.findUnique({
      where: { customerId_restaurantId: { customerId: id, restaurantId } },
      include: { customer: true },
    });
    return link ? toCustomer(link) : null;
  }

  async findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    const link = await prisma.customerRestaurant.findFirst({
      where: { restaurantId, customer: { phone: normalizePhone(phone) } },
      include: { customer: true },
    });
    return link ? toCustomer(link) : null;
  }

  /**
   * One round trip, derived from `payments` — a customer's visits, spend and rhythm are facts
   * about what they actually paid, so nothing is kept in sync:
   *
   *  - the base set is every customer this restaurant knows (`customer_restaurants`), paid or
   *    not — a customer with no payments is listed with zero visits and spend;
   *  - `stats` collapses this branch's payments to one row per customer, the only pass over
   *    `payments`, and leads on `(branch_id, customer_id)`;
   *  - a visit is one dining session, however many payments settled it;
   *  - timestamps are `timestamp without time zone` holding UTC, so `now()` is converted to UTC
   *    before comparing — correct whatever the database server's own timezone is;
   *  - the segment is classified here, not in the app, so it can be filtered and paged on;
   *  - `COUNT(*) OVER()` returns the filtered total beside the page, no second query.
   *
   * ponytail: name search is `ILIKE '%q%'` over this restaurant's customers; add a pg_trgm GIN
   * index on `customers.name` if a restaurant ever has enough customers for that to matter.
   */
  async fetchAll(query: ICustomersFetchQuery, options: IPaginationOptions = {}): Promise<PaginatedResponse<ICustomerListItem>> {
    const { restaurantId, branchId, q, segment } = query;
    const order = ORDER_BY[options.sortBy ?? "lastVisit"] ?? ORDER_BY.lastVisit;
    const direction = Prisma.raw((options.sortOrder ?? order.defaultDir) === "asc" ? "ASC" : "DESC");

    const digits = q?.replace(/\D/g, "") ?? "";
    const search = q
      ? Prisma.sql`AND (c.name ILIKE ${`%${escapeLike(q)}%`} ${digits ? Prisma.sql`OR c.phone LIKE ${`%${digits}%`}` : Prisma.empty})`
      : Prisma.empty;
    const bySegment = segment ? Prisma.sql`WHERE segment = ${segment}` : Prisma.empty;
    const offset = options.offset ?? 0;
    // `returnData: false` is a count-only request.
    const limit = options.returnData === false ? 0 : options.limit;
    const page = limit !== undefined ? Prisma.sql`LIMIT ${limit} OFFSET ${offset}` : Prisma.empty;

    // Shared by the page and the fallback count below.
    const listed = Prisma.sql`
      WITH stats AS (
        SELECT
          p.customer_id,
          COUNT(DISTINCT p.session_id)::int AS visits,
          MAX(p.created_at)                 AS last_visit_at,
          SUM(p.total)::float8              AS spend,
          ARRAY_AGG(DISTINCT GREATEST(FLOOR(EXTRACT(EPOCH FROM timezone('UTC', now()) - p.created_at) / 604800)::int, 0))
            FILTER (WHERE p.created_at >= timezone('UTC', now()) - make_interval(weeks => ${RHYTHM_WEEKS}::int)) AS weeks_ago
        FROM payments p
        WHERE p.branch_id = ${branchId}::uuid
          AND p.restaurant_id = ${restaurantId}::uuid
          AND p.customer_id IS NOT NULL
        GROUP BY p.customer_id
      ),
      listed AS (
        SELECT
          c.id,
          c.name,
          c.phone,
          cr.created_at                  AS joined_at,
          COALESCE(s.visits, 0)          AS visits,
          s.last_visit_at,
          COALESCE(s.spend, 0)           AS spend,
          s.weeks_ago,
          CASE
            WHEN s.last_visit_at IS NULL OR cr.created_at >= timezone('UTC', now()) - make_interval(days => ${NEW_WITHIN_DAYS}::int) THEN 'new'
            WHEN s.last_visit_at < timezone('UTC', now()) - make_interval(days => ${LAPSED_AFTER_DAYS}::int)                         THEN 'lapsed'
            WHEN s.visits >= ${REGULAR_MIN_VISITS}::int                                                             THEN 'regular'
            ELSE 'occasional'
          END AS segment
        FROM customer_restaurants cr
        JOIN customers c ON c.id = cr.customer_id
        LEFT JOIN stats s ON s.customer_id = c.id
        WHERE cr.restaurant_id = ${restaurantId}::uuid ${search}
      )
    `;

    const rows = await this.prisma.$queryRaw<CustomerListRow[]>`
      ${listed}
      SELECT
        id,
        name,
        phone,
        segment,
        visits,
        last_visit_at AS "lastVisitAt",
        spend,
        joined_at     AS "joinedAt",
        weeks_ago     AS "weeksAgo",
        (COUNT(*) OVER ())::int AS total
      FROM listed
      ${bySegment}
      ORDER BY ${order.column} ${direction} NULLS LAST, id
      ${page}
    `;

    // The window count rides on the rows, so it's lost when there are none: a count-only request,
    // or an offset past the last page. Only then is the total worth a second query.
    let count = rows[0]?.total ?? 0;
    if (rows.length === 0 && (offset > 0 || options.returnData === false)) {
      const [counted] = await this.prisma.$queryRaw<{ count: number }[]>`
        ${listed}
        SELECT COUNT(*)::int AS count FROM listed ${bySegment}
      `;
      count = counted?.count ?? 0;
    }

    return {
      rows: rows.map(({ weeksAgo, total: _total, ...row }) => ({
        ...row,
        // index 0 is the oldest week, `RHYTHM_WEEKS - 1` this one
        visitWeeks: Array.from({ length: RHYTHM_WEEKS }, (_, i) => (weeksAgo ?? []).includes(RHYTHM_WEEKS - 1 - i)),
      })),
      count,
    };
  }

  /**
   * Two writes — the global `Customer` row by phone, then this restaurant's
   * own `CustomerRestaurant` link — so this always runs as one transaction,
   * reusing the caller's if it gave one.
   */
  async upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer> {
    const phone = normalizePhone(data.phone);
    const run = async (tx: PrismaTransaction): Promise<ICustomer> => {
      const customer = await tx.customer.upsert({
        where: { phone },
        update: { name: data.name },
        create: { phone, name: data.name },
      });

      const link = await tx.customerRestaurant.upsert({
        where: { customerId_restaurantId: { customerId: customer.id, restaurantId: data.restaurantId } },
        update: { defaultAddress: data.defaultAddress, defaultNote: data.defaultNote },
        create: {
          customerId: customer.id,
          restaurantId: data.restaurantId,
          defaultAddress: data.defaultAddress,
          defaultNote: data.defaultNote,
        },
      });

      return toCustomer({ ...link, customer });
    };

    return options?.tx ? run(options.tx) : this.prisma.$transaction(run);
  }
}

export default CustomerRepositoryImpl;
