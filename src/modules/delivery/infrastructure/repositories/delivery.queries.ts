import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import {
  IDeliveryAssignment,
  IDeliveryBalance,
  IDeliveryCourierDetail,
  IDeliveryOverview,
  IDeliveryPartner,
  IDeliveryRider,
  IDeliverySettlement,
  IPartnerListing,
  IRiderListing,
  IStatementEntry,
  IStatementPage,
} from "../../domain/interfaces/delivery.interface";
import { CourierKind, IDeliveryScope, IStatementCursor } from "../../domain/repositories/delivery.repository";
import { IAccountTotals, accountBalance } from "../../domain/utils/delivery-balance.util";

/**
 * The read side of the Delivery pages, in raw SQL. Balances are summed by the database, so what leaves it
 * is a row per courier or per statement line — never the branch's whole history. Enum literals are inlined
 * (never user text) so Postgres keeps using the `(account_kind, account_id, …)` indexes.
 */

const kindSql = (kind: CourierKind) => (kind === "PARTNER" ? Prisma.sql`'PARTNER'` : Prisma.sql`'RIDER'`);

const scopeSql = (scope: IDeliveryScope) => Prisma.sql`restaurant_id = ${scope.restaurantId}::uuid AND branch_id = ${scope.branchId}::uuid`;

/** The last 30 days, in the UTC the `timestamp(3)` columns are stored in. */
const THIRTY_DAYS_AGO = Prisma.sql`((now() AT TIME ZONE 'UTC') - interval '30 days')`;

const PARTNER_COLUMNS = Prisma.sql`
  p.id,
  p.restaurant_id AS "restaurantId",
  p.branch_id AS "branchId",
  p.name,
  p.phone,
  p.contact_person AS "contactPerson",
  p.note,
  p.fee_model::text AS "feeModel",
  p.fee_value AS "feeValue",
  p.collects_cash AS "collectsCash",
  p.is_active AS "isActive",
  p.created_at AS "createdAt"`;

const RIDER_COLUMNS = Prisma.sql`
  rd.id,
  rd.restaurant_id AS "restaurantId",
  rd.branch_id AS "branchId",
  rd.partner_id AS "partnerId",
  rd.name,
  rd.phone,
  rd.kind::text AS kind,
  rd.vehicle,
  rd.note,
  rd.pay_model::text AS "payModel",
  rd.pay_value AS "payValue",
  rd.is_active AS "isActive",
  rd.created_at AS "createdAt"`;

const ASSIGNMENT_COLUMNS = Prisma.sql`
  id,
  restaurant_id AS "restaurantId",
  branch_id AS "branchId",
  order_id AS "orderId",
  order_ref AS "orderRef",
  customer_name AS "customerName",
  order_total AS "orderTotal",
  rider_id AS "riderId",
  partner_id AS "partnerId",
  rider_name AS "riderName",
  partner_name AS "partnerName",
  account_kind::text AS "accountKind",
  account_id AS "accountId",
  status::text AS status,
  assigned_at AS "assignedAt",
  delivered_at AS "deliveredAt",
  courier_fee AS "courierFee",
  cash_to_collect AS "cashToCollect",
  cash_collected AS "cashCollected"`;

const SETTLEMENT_COLUMNS = Prisma.sql`
  id,
  restaurant_id AS "restaurantId",
  branch_id AS "branchId",
  account_kind::text AS "accountKind",
  account_id AS "accountId",
  order_id AS "orderId",
  direction::text AS direction,
  amount,
  "offset",
  method::text AS method,
  note,
  created_at AS "at"`;

/** What an account has earned and been paid, one row per account. `accountId` narrows it to one. */
const accountRuns = (scope: IDeliveryScope, kind: CourierKind, accountId?: string) => Prisma.sql`
  SELECT
    account_id,
    COALESCE(SUM(cash_collected) FILTER (WHERE status = 'DELIVERED'), 0)::int AS cash_collected,
    COALESCE(SUM(courier_fee) FILTER (WHERE status = 'DELIVERED'), 0)::int AS fees_earned,
    (COUNT(*) FILTER (WHERE status = 'ASSIGNED'))::int AS open,
    (COUNT(*) FILTER (WHERE status = 'DELIVERED' AND COALESCE(delivered_at, assigned_at) >= ${THIRTY_DAYS_AGO}))::int AS runs30
  FROM delivery_assignments
  WHERE ${scopeSql(scope)} AND account_kind = ${kindSql(kind)}
    ${accountId ? Prisma.sql`AND account_id = ${accountId}::uuid` : Prisma.empty}
  GROUP BY account_id`;

const accountSettled = (scope: IDeliveryScope, kind: CourierKind, accountId?: string) => Prisma.sql`
  SELECT
    account_id,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'COLLECT'), 0)::int AS collected,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'PAYOUT'), 0)::int AS paid_out,
    COALESCE(SUM("offset"), 0)::int AS offsets
  FROM delivery_settlements
  WHERE ${scopeSql(scope)} AND account_kind = ${kindSql(kind)}
    ${accountId ? Prisma.sql`AND account_id = ${accountId}::uuid` : Prisma.empty}
  GROUP BY account_id`;

/** The totals columns `accountRuns` and `accountSettled` leave on a courier's row once left-joined as `ru` and `se`. */
const TOTALS_COLUMNS = Prisma.sql`
  COALESCE(ru.cash_collected, 0)::int AS "cashCollected",
  COALESCE(ru.fees_earned, 0)::int AS "feesEarned",
  COALESCE(se.collected, 0)::int AS collected,
  COALESCE(se.paid_out, 0)::int AS "paidOut",
  COALESCE(se.offsets, 0)::int AS offsets`;

type Totals = IAccountTotals;
type PartnerRow = IDeliveryPartner & Totals & { open: number; runs30: number; riders: number };
type RiderRow = IDeliveryRider & Totals & { open: number; runs30: number; partnerName: string | null };

const balanceOf = (row: Totals, open: number): IDeliveryBalance => ({ ...accountBalance(row), open });

async function listPartners(prisma: PrismaService, scope: IDeliveryScope, id?: string): Promise<IPartnerListing[]> {
  const rows = await prisma.$queryRaw<PartnerRow[]>`
    SELECT
      ${PARTNER_COLUMNS},
      ${TOTALS_COLUMNS},
      COALESCE(ru.open, 0)::int AS open,
      COALESCE(ru.runs30, 0)::int AS runs30,
      (SELECT COUNT(*) FROM delivery_riders x WHERE x.partner_id = p.id)::int AS riders
    FROM delivery_partners p
    LEFT JOIN (${accountRuns(scope, "PARTNER", id)}) ru ON ru.account_id = p.id
    LEFT JOIN (${accountSettled(scope, "PARTNER", id)}) se ON se.account_id = p.id
    WHERE p.restaurant_id = ${scope.restaurantId}::uuid AND p.branch_id = ${scope.branchId}::uuid
      ${id ? Prisma.sql`AND p.id = ${id}::uuid` : Prisma.empty}
    ORDER BY p.created_at`;
  return rows.map(({ cashCollected, feesEarned, collected, paidOut, offsets, open, runs30, riders, ...partner }) => ({
    ...partner,
    riders,
    runs30,
    balance: balanceOf({ cashCollected, feesEarned, collected, paidOut, offsets }, open),
  }));
}

/** `where` narrows the riders (one rider, or one partner's); a rider's open and 30-day counts are by rider, not by account. */
async function listRiders(prisma: PrismaService, scope: IDeliveryScope, where: Prisma.Sql = Prisma.empty): Promise<IRiderListing[]> {
  const rows = await prisma.$queryRaw<RiderRow[]>`
    SELECT
      ${RIDER_COLUMNS},
      ${TOTALS_COLUMNS},
      COALESCE(mi.open, 0)::int AS open,
      COALESCE(mi.runs30, 0)::int AS runs30,
      pa.name AS "partnerName"
    FROM delivery_riders rd
    LEFT JOIN delivery_partners pa ON pa.id = rd.partner_id
    LEFT JOIN (${accountRuns(scope, "RIDER")}) ru ON ru.account_id = rd.id
    LEFT JOIN (${accountSettled(scope, "RIDER")}) se ON se.account_id = rd.id
    LEFT JOIN (
      SELECT
        rider_id,
        (COUNT(*) FILTER (WHERE status = 'ASSIGNED'))::int AS open,
        (COUNT(*) FILTER (WHERE status = 'DELIVERED' AND COALESCE(delivered_at, assigned_at) >= ${THIRTY_DAYS_AGO}))::int AS runs30
      FROM delivery_assignments
      WHERE ${scopeSql(scope)} AND rider_id IS NOT NULL
      GROUP BY rider_id
    ) mi ON mi.rider_id = rd.id
    WHERE rd.restaurant_id = ${scope.restaurantId}::uuid AND rd.branch_id = ${scope.branchId}::uuid ${where}
    ORDER BY rd.created_at`;
  return rows.map(({ cashCollected, feesEarned, collected, paidOut, offsets, open, runs30, partnerName, ...rider }) => ({
    ...rider,
    open,
    runs30,
    partnerName,
    // A partner's rider carries no balance of their own — the partner's account takes it.
    balance: rider.partnerId ? null : balanceOf({ cashCollected, feesEarned, collected, paidOut, offsets }, open),
  }));
}

export async function fetchOverview(prisma: PrismaService, scope: IDeliveryScope): Promise<IDeliveryOverview> {
  const [partners, riders, [onRoad]] = await Promise.all([
    listPartners(prisma, scope),
    listRiders(prisma, scope),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM delivery_assignments WHERE ${scopeSql(scope)} AND status = 'ASSIGNED'`,
  ]);
  const balances = [...partners.map(p => p.balance), ...riders.flatMap(r => (r.balance ? [r.balance] : []))];
  return {
    partners,
    riders,
    summary: {
      onRoad: onRoad?.count ?? 0,
      cashOut: balances.reduce((sum, b) => sum + Math.max(b.cashHeld, 0), 0),
      owed: balances.reduce((sum, b) => sum + Math.max(b.feesOwed, 0), 0),
    },
  };
}

export async function fetchCourierDetail(
  prisma: PrismaService,
  scope: IDeliveryScope,
  kind: CourierKind,
  id: string
): Promise<IDeliveryCourierDetail | null> {
  if (kind === "PARTNER") {
    const [[partner], riders, openRuns] = await Promise.all([
      listPartners(prisma, scope, id),
      listRiders(prisma, scope, Prisma.sql`AND rd.partner_id = ${id}::uuid`),
      prisma.$queryRaw<IDeliveryAssignment[]>`
        SELECT ${ASSIGNMENT_COLUMNS} FROM delivery_assignments
        WHERE ${scopeSql(scope)} AND status = 'ASSIGNED' AND (partner_id = ${id}::uuid OR (account_kind = 'PARTNER' AND account_id = ${id}::uuid))
        ORDER BY assigned_at DESC`,
    ]);
    return partner ? { partner, rider: null, parent: null, openRuns, riders, partners: [] } : null;
  }

  const [rider] = await listRiders(prisma, scope, Prisma.sql`AND rd.id = ${id}::uuid`);
  if (!rider) return null;
  const [partners, openRuns] = await Promise.all([
    prisma.$queryRaw<IDeliveryPartner[]>`
      SELECT ${PARTNER_COLUMNS} FROM delivery_partners p
      WHERE p.restaurant_id = ${scope.restaurantId}::uuid AND p.branch_id = ${scope.branchId}::uuid
        AND (p.is_active ${rider.partnerId ? Prisma.sql`OR p.id = ${rider.partnerId}::uuid` : Prisma.empty})
      ORDER BY p.created_at`,
    prisma.$queryRaw<IDeliveryAssignment[]>`
      SELECT ${ASSIGNMENT_COLUMNS} FROM delivery_assignments
      WHERE ${scopeSql(scope)} AND status = 'ASSIGNED' AND rider_id = ${id}::uuid
      ORDER BY assigned_at DESC`,
  ]);
  return { partner: null, rider, parent: partners.find(p => p.id === rider.partnerId) ?? null, openRuns, riders: [], partners };
}

interface EntryRow {
  type: "DELIVERY" | "SETTLEMENT" | "RUN";
  rank: number;
  id: string;
  at: Date;
  delta: number;
  balanceAfter: number | null;
}

/**
 * An account's lines are its delivered runs and its settlements, merged by time with a running balance —
 * a window over this one account only. A partner's rider has no ledger, so theirs are just their delivered runs.
 */
export async function fetchStatement(
  prisma: PrismaService,
  scope: IDeliveryScope,
  kind: CourierKind,
  id: string,
  options: { limit: number; cursor?: IStatementCursor }
): Promise<IStatementPage | null> {
  let viaPartner = false;
  if (kind === "RIDER") {
    const [rider] = await prisma.$queryRaw<{ partnerId: string | null }[]>`
      SELECT partner_id AS "partnerId" FROM delivery_riders WHERE ${scopeSql(scope)} AND id = ${id}::uuid`;
    if (!rider) return null;
    viaPartner = rider.partnerId !== null;
  } else {
    const [partner] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM delivery_partners WHERE ${scopeSql(scope)} AND id = ${id}::uuid`;
    if (!partner) return null;
  }

  const { limit, cursor } = options;
  const before = cursor
    ? Prisma.sql`WHERE (at, rank, id) < (${cursor.at.toISOString()}::timestamp, ${cursor.rank}::int, ${cursor.id}::uuid)`
    : Prisma.empty;

  const rows = viaPartner
    ? await prisma.$queryRaw<EntryRow[]>`
        WITH entries AS (
          SELECT 'RUN'::text AS type, 0 AS rank, id, COALESCE(delivered_at, assigned_at) AS at, 0 AS delta, NULL::int AS "balanceAfter"
          FROM delivery_assignments
          WHERE ${scopeSql(scope)} AND rider_id = ${id}::uuid AND status = 'DELIVERED'
        )
        SELECT * FROM entries ${before} ORDER BY at DESC, rank DESC, id DESC LIMIT ${limit + 1}`
    : await prisma.$queryRaw<EntryRow[]>`
        WITH entries AS (
          SELECT 'DELIVERY'::text AS type, 0 AS rank, id, COALESCE(delivered_at, assigned_at) AS at, COALESCE(cash_collected, 0) - courier_fee AS delta
          FROM delivery_assignments
          WHERE ${scopeSql(scope)} AND account_kind = ${kindSql(kind)} AND account_id = ${id}::uuid AND status = 'DELIVERED'
          UNION ALL
          SELECT 'SETTLEMENT'::text, 1, id, created_at, CASE WHEN direction = 'COLLECT' THEN -amount ELSE amount END
          FROM delivery_settlements
          WHERE ${scopeSql(scope)} AND account_kind = ${kindSql(kind)} AND account_id = ${id}::uuid
        ), running AS (
          SELECT *, (SUM(delta) OVER (ORDER BY at, rank, id))::int AS "balanceAfter" FROM entries
        )
        SELECT * FROM running ${before} ORDER BY at DESC, rank DESC, id DESC LIMIT ${limit + 1}`;

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? `${last.at.toISOString()}|${last.rank}|${last.id}` : null;

  // The page's own rows, by primary key. Two small lookups, in parallel.
  const runIds = page.filter(row => row.type !== "SETTLEMENT").map(row => row.id);
  const settlementIds = page.filter(row => row.type === "SETTLEMENT").map(row => row.id);
  const [assignments, settlements] = await Promise.all([
    runIds.length
      ? prisma.$queryRaw<IDeliveryAssignment[]>`SELECT ${ASSIGNMENT_COLUMNS} FROM delivery_assignments WHERE id = ANY(${runIds}::uuid[])`
      : Promise.resolve<IDeliveryAssignment[]>([]),
    settlementIds.length
      ? prisma.$queryRaw<
          IDeliverySettlement[]
        >`SELECT ${SETTLEMENT_COLUMNS} FROM delivery_settlements WHERE id = ANY(${settlementIds}::uuid[])`
      : Promise.resolve<IDeliverySettlement[]>([]),
  ]);
  const assignmentById = new Map(assignments.map(a => [a.id, a]));
  const settlementById = new Map(settlements.map(s => [s.id, s]));

  const entries = page.flatMap((row): IStatementEntry[] => {
    if (row.type === "SETTLEMENT") {
      const settlement = settlementById.get(row.id);
      return settlement
        ? [{ type: "SETTLEMENT", id: row.id, at: row.at, delta: row.delta, balanceAfter: row.balanceAfter ?? 0, settlement }]
        : [];
    }
    const assignment = assignmentById.get(row.id);
    if (!assignment) return [];
    return row.type === "RUN"
      ? [{ type: "RUN", id: row.id, at: row.at, assignment }]
      : [{ type: "DELIVERY", id: row.id, at: row.at, delta: row.delta, balanceAfter: row.balanceAfter ?? 0, assignment }];
  });

  return { entries, nextCursor };
}
