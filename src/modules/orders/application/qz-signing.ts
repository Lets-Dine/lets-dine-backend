import { createSign } from "node:crypto";
import { BadRequestException } from "../../../common/exceptions";
import { ORDER_ERROR_MESSAGES } from "../domain/constants";

/** The PEM itself. Newlines may be written as `\n` so the value fits on one line. */
function load(name: "QZ_CERTIFICATE" | "QZ_PRIVATE_KEY"): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

/** The public certificate every restaurant installs. The private key never leaves the server. */
export function qzCertificate(): string {
  const pem = load("QZ_CERTIFICATE");
  if (!pem?.includes("BEGIN CERTIFICATE")) throw new BadRequestException(ORDER_ERROR_MESSAGES.QZ_NOT_CONFIGURED);
  return pem.endsWith("\n") ? pem : `${pem}\n`;
}

/** SHA-512 signature of the exact string QZ Tray asked the page to sign. */
export function signQzRequest(request: string): string {
  const key = load("QZ_PRIVATE_KEY");
  if (!key?.includes("BEGIN")) throw new BadRequestException(ORDER_ERROR_MESSAGES.QZ_NOT_CONFIGURED);
  qzCertificate();
  const signer = createSign("SHA512");
  signer.update(request);
  return signer.sign(key, "base64");
}
