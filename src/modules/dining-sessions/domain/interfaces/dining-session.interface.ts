export interface IDiningSession {
  id: string;
  restaurantId: string;
  tableId: string;
  /** §22 — the diner's entire identity. No account, no personal data. */
  anonymousSessionToken: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
