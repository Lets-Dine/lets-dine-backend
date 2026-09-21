/** §22/§52 — the diner's whole identity, kept short enough to read aloud or type from across the table. */
export function generateSessionToken(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export function sessionExpiryFrom(startedAt: Date, ttlMinutes: number): Date {
  return new Date(startedAt.getTime() + ttlMinutes * 60 * 1000);
}
