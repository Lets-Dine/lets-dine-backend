export interface IDiningSession {
  id: string;
  restaurantId: string;
  /** The branch this visit happened at — copied from its table/floor, never from the client. */
  branchId: string;
  /** Null for a delivery or floor session — see `customerId`/`floorId`. */
  tableId: string | null;
  /** Set only for a delivery session — the `Customer` it was opened for. A floor order's own `Customer` lives on the order instead (§16b). */
  customerId: string | null;
  /** Set only for a floor session (§16b) — the shared floor QR it was scanned from. */
  floorId: string | null;
  /** Legacy — floor sessions used to collect this up front; identity is now captured per order instead (see `Order.floorVisitorName`). */
  floorVisitorName: string | null;
  /** §22 — the diner's entire identity. No account, no personal data. */
  anonymousSessionToken: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  /** Set while the diner is waiting on a waiter / the bill — cleared by staff. */
  waiterCalledAt: Date | null;
  billRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What the pass sees: one open visit that wants attention, labelled with where it is. */
export interface IServiceRequest {
  sessionId: string;
  restaurantId: string;
  branchId: string;
  /** The table's name, or the floor's for a floor visit. */
  label: string;
  waiterCalledAt: Date | null;
  billRequestedAt: Date | null;
}
