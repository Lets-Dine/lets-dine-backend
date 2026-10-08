import { prorateUpgrade } from "../proration.util";

const period = { start: new Date("2026-03-01T00:00:00.000Z"), end: new Date("2026-04-01T00:00:00.000Z") };

describe("prorateUpgrade", () => {
  it("should scale the price difference by the share of the period left", () => {
    expect(prorateUpgrade({ from: 100, to: 300 }, period, new Date("2026-03-16T12:00:00.000Z"))).toBe(100);
  });

  it("should charge nothing once the period has ended or when the price does not rise", () => {
    expect(prorateUpgrade({ from: 100, to: 300 }, period, new Date("2026-04-02T00:00:00.000Z"))).toBe(0);
    expect(prorateUpgrade({ from: 300, to: 100 }, period, new Date("2026-03-02T00:00:00.000Z"))).toBe(0);
  });
});
