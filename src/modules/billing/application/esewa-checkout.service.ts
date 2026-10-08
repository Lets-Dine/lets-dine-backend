import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../domain/constants";
import { IInvoice } from "../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../domain/repositories/invoice.repository";
import { InvoiceSettlementService } from "./invoice-settlement.service";

const URLS = {
  dev: { form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", status: "https://rc.esewa.com.np/api/epay/transaction/status/" },
  live: { form: "https://epay.esewa.com.np/api/epay/main/v2/form", status: "https://esewa.com.np/api/epay/transaction/status/" },
};

export interface IEsewaCheckout {
  /** POST these as form fields to `url`; eSewa takes the payer from there. */
  url: string;
  fields: Record<string, string>;
}

/** eSewa signs `name=value` pairs, comma-joined in the order it names them, HMAC-SHA256 as base64. */
export function esewaSign(secret: string, names: string[], values: Record<string, string>): string {
  return createHmac("sha256", secret)
    .update(names.map(n => `${n}=${values[n]}`).join(","))
    .digest("base64");
}

/** The amount as eSewa wants it (rupees, not paisa) — also what gets signed, so it must be formed one way only. */
const rupees = (minor: number) => String(minor / 100);

// ponytail: stateless — the invoice id rides inside transaction_uuid (unique per attempt, as eSewa requires)
// instead of a payment-attempt table. Add one if attempts ever need listing or expiring.
const attemptId = (invoiceId: string, now: Date) => `${invoiceId}-${now.getTime().toString(36)}`;
const invoiceIdOf = (transactionUuid: string) => transactionUuid.slice(0, 36);

@Injectable()
export class EsewaCheckoutService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly settlement: InvoiceSettlementService
  ) {}

  private config() {
    const { ESEWA_PRODUCT_CODE: productCode, ESEWA_SECRET_KEY: secret, ESEWA_RETURN_URL: returnUrl } = process.env;
    if (!productCode || !secret || !returnUrl) throw new BadRequestException(BILLING_ERROR_MESSAGES.ESEWA_NOT_CONFIGURED);
    return { productCode, secret, returnUrl, urls: process.env.ESEWA_ENV === "live" ? URLS.live : URLS.dev };
  }

  private async ownInvoice(invoiceId: string, restaurantId: string): Promise<IInvoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    // Someone else's invoice is "not found", not "forbidden" — no confirming it exists.
    if (!invoice || invoice.restaurantId !== restaurantId) throw new NotFoundException(BILLING_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    return invoice;
  }

  async start(invoiceId: string, restaurantId: string, now: Date = new Date()): Promise<IEsewaCheckout> {
    const c = this.config();
    const invoice = await this.ownInvoice(invoiceId, restaurantId);
    if (invoice.status !== "OPEN") throw new BadRequestException(BILLING_ERROR_MESSAGES.INVOICE_NOT_OPEN);
    if (invoice.currency !== "NPR") throw new BadRequestException(BILLING_ERROR_MESSAGES.ESEWA_NPR_ONLY);

    const total = rupees(invoice.amount);
    const fields: Record<string, string> = {
      amount: total,
      tax_amount: "0",
      total_amount: total,
      transaction_uuid: attemptId(invoice.id, now),
      product_code: c.productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: c.returnUrl,
      failure_url: c.returnUrl,
      signed_field_names: "total_amount,transaction_uuid,product_code",
    };
    fields.signature = esewaSign(c.secret, ["total_amount", "transaction_uuid", "product_code"], fields);
    return { url: c.urls.form, fields };
  }

  /**
   * `data` is the base64 blob eSewa appends to the success URL. It passes through the payer's
   * browser, so it is only believed after its signature checks out AND eSewa's own status API
   * agrees — then the invoice settles through the same path as a manual mark-paid.
   */
  async confirm(data: string, restaurantId: string): Promise<IInvoice> {
    const c = this.config();
    const bad = () => new BadRequestException(BILLING_ERROR_MESSAGES.ESEWA_PAYMENT_INVALID);

    let p: Record<string, string>;
    try {
      p = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    } catch {
      throw bad();
    }
    const names = String(p.signed_field_names ?? "").split(",");
    for (const required of ["transaction_code", "status", "total_amount", "transaction_uuid", "product_code"]) {
      if (!names.includes(required)) throw bad();
    }
    if (esewaSign(c.secret, names, p) !== p.signature || p.status !== "COMPLETE" || p.product_code !== c.productCode) throw bad();

    const invoice = await this.ownInvoice(invoiceIdOf(p.transaction_uuid), restaurantId);
    // A refreshed or replayed success page: already settled by this very transaction.
    if (invoice.status === "PAID" && invoice.paymentRef === p.transaction_code) return invoice;
    if (Number(p.total_amount.replace(/,/g, "")) !== invoice.amount / 100) throw bad();

    const query = new URLSearchParams({
      product_code: c.productCode,
      total_amount: rupees(invoice.amount),
      transaction_uuid: p.transaction_uuid,
    });
    const res = await fetch(`${c.urls.status}?${query}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res) throw new BadRequestException(BILLING_ERROR_MESSAGES.ESEWA_UNREACHABLE);
    const status = (await res.json().catch(() => null)) as { status?: string } | null;
    if (status?.status !== "COMPLETE") throw bad();

    return this.settlement.settle(invoice.id, { paymentMethod: "esewa", paymentRef: p.transaction_code });
  }
}
