import { createHmac, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { PrismaService } from "../../../../common/prisma";
import { open, seal } from "./secret-box";

const DEV_URL = "https://dev-merchant-api.fonepay.com/api/merchant/merchantDetailsForThirdParty";
const LIVE_URL = "https://merchant-api.fonepay.com/api/merchant/merchantDetailsForThirdParty";

export interface IFonepayQr {
  /** The EMV payload — render it as a QR code. */
  qrMessage: string;
  /** Pushes a message when the payment lands; connect to it instead of polling. */
  webSocketUrl: string;
}

export const NOT_CONFIGURED = {
  key: "FONEPAY_NOT_CONFIGURED",
  message: "This restaurant hasn't set up Fonepay",
};
export const DISABLED = { key: "FONEPAY_DISABLED", message: "Fonepay is switched off for this restaurant" };
export const QR_FAILED = { key: "FONEPAY_QR_FAILED", message: "Fonepay couldn't generate a QR just now" };
export const UNREACHABLE = { key: "FONEPAY_UNREACHABLE", message: "Couldn't reach Fonepay. Try again in a moment" };
export const REJECTED = { key: "FONEPAY_REJECTED", message: "Fonepay didn't accept these details. Check them and try again" };

interface ICredentials {
  merchantCode: string;
  username: string;
  secretKey: string;
  password: string;
}

/** Fonepay wants HMAC-SHA512 (hex) of the request values, comma-joined in a fixed order. */
export function fonepaySign(secret: string, ...values: string[]): string {
  return createHmac("sha512", secret).update(values.join(",")).digest("hex");
}

@Injectable()
export class FonepayService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts the restaurant's merchant credentials, encrypting the two secrets. */
  async saveConfig(restaurantId: string, c: ICredentials) {
    // Ask Fonepay for a throwaway QR first: it only succeeds if all four values work together.
    // FONEPAY_VERIFY_ON_SAVE=false skips it (no merchant account to test with, offline dev).
    if (process.env.FONEPAY_VERIFY_ON_SAVE !== "false") {
      await this.requestQr(c, { prn: `verify-${randomUUID()}`, amount: 1 }, REJECTED);
    }
    const data = { merchantCode: c.merchantCode, username: c.username, secretKey: seal(c.secretKey), password: seal(c.password) };
    await this.prisma.restaurantFonepayConfig.upsert({ where: { restaurantId }, create: { restaurantId, ...data }, update: data });
  }

  /** Switches the mode off/on while keeping the saved credentials. */
  async setEnabled(restaurantId: string, enabled: boolean) {
    const { count } = await this.prisma.restaurantFonepayConfig.updateMany({ where: { restaurantId }, data: { enabled } });
    if (!count) throw new BadRequestException(NOT_CONFIGURED);
  }

  /** Never returns the secrets — just enough for the settings screen to show it's set up. */
  async getConfigSummary(restaurantId: string) {
    const c = await this.prisma.restaurantFonepayConfig.findUnique({ where: { restaurantId } });
    return { configured: !!c, enabled: c?.enabled ?? false, merchantCode: c?.merchantCode ?? null, username: c?.username ?? null };
  }

  /** `prn` is our unique reference for this payment (Fonepay rejects a reused one). */
  async generateDynamicQr(input: {
    restaurantId: string;
    prn: string;
    amount: number;
    remarks1?: string;
    remarks2?: string;
  }): Promise<IFonepayQr> {
    const config = await this.prisma.restaurantFonepayConfig.findUnique({ where: { restaurantId: input.restaurantId } });
    if (!config) throw new BadRequestException(NOT_CONFIGURED);
    if (!config.enabled) throw new BadRequestException(DISABLED);
    const creds = { ...config, secretKey: open(config.secretKey), password: open(config.password) };
    return this.requestQr(creds, input, QR_FAILED);
  }

  /** `refusal` is what the caller sees when Fonepay answers but says no; an unreachable Fonepay is always `UNREACHABLE`. */
  private async requestQr(
    c: ICredentials,
    input: { prn: string; amount: number; remarks1?: string; remarks2?: string },
    refusal: { key: string; message: string }
  ): Promise<IFonepayQr> {
    const amount = input.amount.toFixed(2);
    const remarks1 = input.remarks1 ?? "N/A";
    const remarks2 = input.remarks2 ?? "N/A";
    const body = {
      amount,
      remarks1,
      remarks2,
      prn: input.prn,
      merchantCode: c.merchantCode,
      dataValidation: fonepaySign(c.secretKey, amount, input.prn, c.merchantCode, remarks1, remarks2),
      username: c.username,
      password: c.password,
    };

    const base = process.env.FONEPAY_ENV === "live" ? LIVE_URL : DEV_URL;
    const res = await fetch(`${base}/thirdPartyDynamicQrDownload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res || res.status >= 500) throw new BadRequestException(UNREACHABLE);

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json?.success || typeof json.qrMessage !== "string") throw new BadRequestException(refusal);

    return { qrMessage: json.qrMessage, webSocketUrl: String(json.thirdpartyQrWebSocketUrl ?? "") };
  }
}
