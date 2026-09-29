export interface IDiningSession {
  id: string;
  restaurantId: string;
  /** Null for a delivery session — see `customerId`. */
  tableId: string | null;
  /** Set only for a delivery session — the `Customer` it was opened for. */
  customerId: string | null;
  /** §22 — the diner's entire identity. No account, no personal data. */
  anonymousSessionToken: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
