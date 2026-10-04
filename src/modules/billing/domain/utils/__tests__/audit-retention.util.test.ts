import { clampToRetention } from "../audit-retention.util";

const NOW = new Date("2026-03-31T12:00:00.000Z");

describe("clampToRetention", () => {
  it("should leave the range alone when the plan keeps the full history", () => {
    // Arrange
    const from = new Date("2020-01-01T00:00:00.000Z");

    // Act & Assert
    expect(clampToRetention(from, undefined, NOW)).toBe(from);
    expect(clampToRetention(undefined, undefined, NOW)).toBeUndefined();
  });

  it("should start an open-ended query at the edge of the retention window", () => {
    // Act & Assert
    expect(clampToRetention(undefined, 30, NOW)).toEqual(new Date("2026-03-01T12:00:00.000Z"));
  });

  it("should pull a start date older than the window forward to its edge", () => {
    // Act & Assert
    expect(clampToRetention(new Date("2025-01-01T00:00:00.000Z"), 30, NOW)).toEqual(new Date("2026-03-01T12:00:00.000Z"));
  });

  it("should keep a start date that is already inside the window", () => {
    // Arrange
    const from = new Date("2026-03-20T00:00:00.000Z");

    // Act & Assert
    expect(clampToRetention(from, 30, NOW)).toBe(from);
  });
});
