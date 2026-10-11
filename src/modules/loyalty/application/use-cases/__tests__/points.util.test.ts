import { maxRedeemablePoints, pointsFor } from "../../../domain/utils/points.util";

describe("points.util", () => {
  describe("maxRedeemablePoints", () => {
    it("should round the cap down to whole points when it does not divide evenly", () => {
      // Arrange & Act: 50% of 333 = 166, at 50 a point that is 3 points.
      const max = maxRedeemablePoints(333, 1000, 50, 50);

      // Assert
      expect(max).toBe(3);
    });

    it("should never exceed the balance", () => {
      expect(maxRedeemablePoints(40000, 7, 50, 50)).toBe(7);
    });

    it("should be zero for an empty or negative base, or a zero rate", () => {
      expect(maxRedeemablePoints(0, 100, 50, 50)).toBe(0);
      expect(maxRedeemablePoints(-500, 100, 50, 50)).toBe(0);
      expect(maxRedeemablePoints(40000, 100, 0, 50)).toBe(0);
    });
  });

  describe("pointsFor", () => {
    it("should round down and ignore a discount larger than the subtotal", () => {
      expect(pointsFor(45999, 0, 1000)).toBe(45);
      expect(pointsFor(1000, 5000, 1000)).toBe(0);
    });
  });
});
