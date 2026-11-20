import { PrinterLink } from "@prisma/client";
import { createPrinterSchema } from "../create-printer.validation";
import { updatePrinterSchema } from "../update-printer.validation";

describe("printer link", () => {
  it("keeps a network printer on its IP", () => {
    expect(createPrinterSchema.safeParse({ name: "Cafe" }).success).toBe(false);
    const parsed = createPrinterSchema.parse({ name: "Cafe", ipAddress: "192.168.1.50" });
    expect(parsed.ipAddress).toBe("192.168.1.50");
    expect(parsed.link).toBeUndefined();
  });

  it("accepts a Bluetooth printer with no IP", () => {
    const parsed = createPrinterSchema.parse({ name: "Bar", link: PrinterLink.BLUETOOTH, deviceName: "COM5", serial: true });
    expect(parsed.deviceName).toBe("COM5");
    expect(parsed.serial).toBe(true);
  });

  it("rejects a Bluetooth printer with no device", () => {
    expect(createPrinterSchema.safeParse({ name: "Bar", link: PrinterLink.BLUETOOTH }).success).toBe(false);
  });

  it("lets a name-only update through, and still checks a Bluetooth switch", () => {
    expect(updatePrinterSchema.safeParse({ name: "Cafe" }).success).toBe(true);
    expect(updatePrinterSchema.safeParse({ link: PrinterLink.BLUETOOTH }).success).toBe(false);
    expect(updatePrinterSchema.safeParse({ link: PrinterLink.BLUETOOTH, deviceName: "BT-58" }).success).toBe(true);
    expect(updatePrinterSchema.safeParse({ link: PrinterLink.NETWORK }).success).toBe(false);
  });
});
