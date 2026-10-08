import { EsewaCheckoutService, esewaSign } from "../esewa-checkout.service";
import { buildInvoice } from "./billing.fixtures";

const SECRET = "test-secret";
const NAMES = ["transaction_code", "status", "total_amount", "transaction_uuid", "product_code"];

const setup = (invoice = buildInvoice()) => {
  process.env.ESEWA_PRODUCT_CODE = "EPAYTEST";
  process.env.ESEWA_SECRET_KEY = SECRET;
  process.env.ESEWA_RETURN_URL = "http://web/admin/plan";
  const settle = jest.fn(async () => ({ ...invoice, status: "PAID" as const }));
  const repo = { findById: jest.fn(async () => invoice) };
  const service = new EsewaCheckoutService(repo as never, { settle } as never);
  return { service, settle, invoice };
};

const callback = (overrides: Record<string, string> = {}, secret = SECRET) => {
  const p: Record<string, string> = {
    transaction_code: "000AB12",
    status: "COMPLETE",
    total_amount: "4,000.0",
    transaction_uuid: "invoice-1-xyz".padStart(36, "0"),
    product_code: "EPAYTEST",
    signed_field_names: NAMES.join(","),
    ...overrides,
  };
  p.signature = esewaSign(secret, p.signed_field_names.split(","), p);
  return Buffer.from(JSON.stringify(p)).toString("base64");
};

describe("EsewaCheckoutService", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  const statusIs = (status: string) => {
    global.fetch = jest.fn(async () => ({ json: async () => ({ status }) })) as never;
  };

  it("start signs rupees, not paisa, and only for the owner's open invoice", async () => {
    const { service, invoice } = setup();
    const { fields } = await service.start(invoice.id, invoice.restaurantId);
    expect(fields.total_amount).toBe("4000");
    expect(fields.signature).toBe(esewaSign(SECRET, ["total_amount", "transaction_uuid", "product_code"], fields));
    await expect(service.start(invoice.id, "someone-else")).rejects.toThrow();
  });

  it("confirm settles a genuine, eSewa-confirmed payment", async () => {
    const { service, settle, invoice } = setup();
    invoice.id = "0".repeat(36 - 13) + "invoice-1-xyz".slice(0, 13); // matches transaction_uuid's first 36 chars
    const uuid = invoice.id + "-abc";
    statusIs("COMPLETE");
    await service.confirm(callback({ transaction_uuid: uuid }), invoice.restaurantId);
    expect(settle).toHaveBeenCalledWith(invoice.id, { paymentMethod: "esewa", paymentRef: "000AB12" });
  });

  it("confirm refuses a forged signature, a wrong amount, a failed status and another restaurant's invoice", async () => {
    const { service, settle, invoice } = setup();
    const uuid = invoice.id.padEnd(36, "0") + "-abc";
    invoice.id = uuid.slice(0, 36);
    statusIs("COMPLETE");
    await expect(service.confirm(callback({ transaction_uuid: uuid }, "wrong-secret"), invoice.restaurantId)).rejects.toThrow();
    await expect(service.confirm(callback({ transaction_uuid: uuid, total_amount: "1" }), invoice.restaurantId)).rejects.toThrow();
    await expect(service.confirm(callback({ transaction_uuid: uuid }), "someone-else")).rejects.toThrow();
    statusIs("PENDING");
    await expect(service.confirm(callback({ transaction_uuid: uuid }), invoice.restaurantId)).rejects.toThrow();
    expect(settle).not.toHaveBeenCalled();
  });
});
