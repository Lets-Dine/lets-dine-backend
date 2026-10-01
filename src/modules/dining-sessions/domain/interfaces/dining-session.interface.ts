export interface IDiningSession {
  id: string;
  restaurantId: string;
  /** Null for a delivery or floor session — see `customerId`/`floorId`. */
  tableId: string | null;
  /** Set only for a delivery session — the `Customer` it was opened for. */
  customerId: string | null;
  /** Set only for a floor session (§16b) — the shared floor QR it was scanned from. */
  floorId: string | null;
  /** Floor sessions only — the free-text room/cabin/name the diner gave when opening the floor QR. */
  floorVisitorName: string | null;
  /** §22 — the diner's entire identity. No account, no personal data. */
  anonymousSessionToken: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
