import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM with SECRETS_ENCRYPTION_KEY (64 hex chars). Output is `iv.tag.ciphertext`, base64. */
function key(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("SECRETS_ENCRYPTION_KEY must be 64 hex chars");
  return Buffer.from(hex, "hex");
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString("base64")).join(".");
}

export function open(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map(p => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
