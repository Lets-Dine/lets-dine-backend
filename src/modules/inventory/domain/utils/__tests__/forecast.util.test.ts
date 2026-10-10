import { forecastByWeekday, quantityToBuy } from "../forecast.util";

const TZ = "Asia/Kathmandu";
// 2026-10-09 is a Friday; noon UTC is 17:45 in Kathmandu, same day.
const friday = new Date("2026-10-09T06:00:00Z");

describe("forecastByWeekday", () => {
  it("weights the same weekday in each recent week, newest most", () => {
    // Saturdays 3, 2 and 1 weeks before `friday` + 1 day.
    const uses = [
      { at: new Date("2026-10-03T06:00:00Z"), quantity: 1000 }, // 6 days ago: last week
      { at: new Date("2026-09-26T06:00:00Z"), quantity: 500 }, // two weeks back
      { at: new Date("2026-09-19T06:00:00Z"), quantity: 0 }, // three weeks back
    ];
    const byDay = forecastByWeekday(uses, TZ, friday);
    expect(byDay[6]).toBeCloseTo(1000 * 0.5 + 500 * 0.3);
    expect(byDay[0]).toBe(0);
  });

  it("ignores use older than the weeks it covers", () => {
    const byDay = forecastByWeekday([{ at: new Date("2026-09-12T06:00:00Z"), quantity: 900 }], TZ, friday);
    expect(byDay.every(n => n === 0)).toBe(true);
  });

  it("reads the weekday on the branch's clock, not UTC", () => {
    // 20:00 UTC Friday is already Saturday 01:45 in Kathmandu.
    const byDay = forecastByWeekday([{ at: new Date("2026-10-02T20:00:00Z"), quantity: 400 }], TZ, friday);
    expect(byDay[6]).toBeCloseTo(200);
    expect(byDay[5]).toBe(0);
  });
});

describe("quantityToBuy", () => {
  const byWeekday = [0, 0, 0, 0, 0, 0, 1000]; // only Saturdays use anything

  it("buys expected use plus the warning line, minus what is on hand", () => {
    expect(quantityToBuy({ onHand: 300, parLevel: 200, byWeekday, now: friday, horizonDays: 1, timeZone: TZ })).toEqual({
      expectedUse: 1000,
      toBuy: 900,
    });
  });

  it("buys nothing when stock already covers it", () => {
    expect(quantityToBuy({ onHand: 5000, parLevel: 200, byWeekday, now: friday, horizonDays: 1, timeZone: TZ }).toBuy).toBe(0);
  });

  it("only counts the days inside the horizon", () => {
    // Tomorrow is Saturday (1000); the day after is Sunday (0).
    expect(quantityToBuy({ onHand: 0, parLevel: 0, byWeekday, now: friday, horizonDays: 2, timeZone: TZ }).expectedUse).toBe(1000);
    // A Friday horizon of 1 would miss Saturday entirely only if "tomorrow" were wrong.
    expect(
      quantityToBuy({ onHand: 0, parLevel: 0, byWeekday: [0, 0, 0, 0, 0, 500, 0], now: friday, horizonDays: 1, timeZone: TZ }).expectedUse
    ).toBe(0);
  });

  it("goes negative-safe when on hand is below zero", () => {
    expect(quantityToBuy({ onHand: -200, parLevel: 0, byWeekday, now: friday, horizonDays: 1, timeZone: TZ }).toBuy).toBe(1200);
  });
});
