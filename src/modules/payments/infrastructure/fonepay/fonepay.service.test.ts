import { PrismaService } from "../../../../common/prisma";
import { FonepayService, fonepaySign } from "./fonepay.service";
import { open, seal } from "./secret-box";

process.env.SECRETS_ENCRYPTION_KEY = "ab".repeat(32);

describe("FonepayService", () => {
  it("round-trips secrets and signs with HMAC-SHA512", () => {
    expect(open(seal("hunter2"))).toBe("hunter2");
    expect(seal("x")).not.toBe(seal("x"));
    expect(fonepaySign("k", "10.00", "p1")).toMatch(/^[0-9a-f]{128}$/);
  });

  it("uses the restaurant's own stored credentials", async () => {
    const row = { enabled: true, merchantCode: "M1", username: "u", secretKey: seal("s"), password: seal("p") };
    const findUnique = jest.fn().mockResolvedValue(row);
    const svc = new FonepayService({ restaurantFonepayConfig: { findUnique } } as unknown as PrismaService);
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true, qrMessage: "000201", thirdpartyQrWebSocketUrl: "wss://x" })));

    const qr = await svc.generateDynamicQr({ restaurantId: "r1", prn: "p1", amount: 150 });

    expect(qr).toEqual({ qrMessage: "000201", webSocketUrl: "wss://x" });
    expect(findUnique).toHaveBeenCalledWith({ where: { restaurantId: "r1" } });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ merchantCode: "M1", username: "u", password: "p" });
    expect(body.dataValidation).toBe(fonepaySign("s", "150.00", "p1", "M1", "N/A", "N/A"));
  });

  it("rejects when the restaurant has no config", async () => {
    const svc = new FonepayService({ restaurantFonepayConfig: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService);
    await expect(svc.generateDynamicQr({ restaurantId: "r2", prn: "p", amount: 1 })).rejects.toBeDefined();
  });

  it("refuses to make a QR while switched off", async () => {
    const row = { enabled: false, merchantCode: "M1", username: "u", secretKey: seal("s"), password: seal("p") };
    const svc = new FonepayService({ restaurantFonepayConfig: { findUnique: jest.fn().mockResolvedValue(row) } } as unknown as PrismaService);
    await expect(svc.generateDynamicQr({ restaurantId: "r3", prn: "p", amount: 1 })).rejects.toBeDefined();
  });

  describe("saveConfig verification", () => {
    const creds = { merchantCode: "M1", username: "u", secretKey: "s", password: "p" };
    const upsert = jest.fn();
    const svc = () => new FonepayService({ restaurantFonepayConfig: { upsert } } as unknown as PrismaService);
    beforeEach(() => upsert.mockReset());
    afterEach(() => delete process.env.FONEPAY_VERIFY_ON_SAVE);

    it("stores only after Fonepay accepts the details", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, qrMessage: "q" })));
      await svc().saveConfig("r1", creds);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it("stores nothing when Fonepay says no, or can't be reached", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 400 }));
      await expect(svc().saveConfig("r1", creds)).rejects.toThrow("didn't accept");
      jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("down"));
      await expect(svc().saveConfig("r1", creds)).rejects.toThrow("Couldn't reach");
      expect(upsert).not.toHaveBeenCalled();
    });

    it("skips the check when FONEPAY_VERIFY_ON_SAVE=false", async () => {
      process.env.FONEPAY_VERIFY_ON_SAVE = "false";
      const fetchSpy = jest.spyOn(global, "fetch");
      fetchSpy.mockClear();
      await svc().saveConfig("r1", creds);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledTimes(1);
    });
  });
});
