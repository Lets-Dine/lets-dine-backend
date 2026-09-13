import { randomBytes } from "node:crypto";

/**
 * §53 — the token is the only thing standing between a stranger and a table's
 * menu, so it is random, opaque and long enough not to be guessed. Rotating it
 * invalidates every QR already printed for that table.
 */
export function generateQrToken(): string {
  return randomBytes(24).toString("base64url");
}
