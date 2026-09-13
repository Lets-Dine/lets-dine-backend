import { randomBytes } from "node:crypto";

/** §22/§52 — opaque, unguessable, and the only credential a diner ever holds. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiryFrom(startedAt: Date, ttlMinutes: number): Date {
  return new Date(startedAt.getTime() + ttlMinutes * 60 * 1000);
}
