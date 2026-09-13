import { calculateOrderTotals, percentOf, sumLines } from "../money.util";

describe("money", () => {
  describe("percentOf", () => {
    it("should round to the nearest minor unit rather than carrying a fraction", () => {
      // Arrange & Act & Assert
      expect(percentOf(12345, 0.13)).toBe(1605);
    });
  });

  describe("sumLines", () => {
    it("should multiply each line before summing", () => {
      // Arrange & Act
      const total = sumLines([
        { unitPrice: 45000, quantity: 2 },
        { unitPrice: 12000, quantity: 3 },
      ]);

      // Assert
      expect(total).toBe(126000);
    });
  });

  describe("calculateOrderTotals", () => {
    it("should charge tax on the subtotal plus service charge", () => {
      // Arrange
      const lines = [{ unitPrice: 100000, quantity: 1 }];

      // Act
      const totals = calculateOrderTotals(lines, { serviceChargeRate: 0.1, taxRate: 0.13 });

      // Assert
      expect(totals).toEqual({
        subtotal: 100000,
        serviceCharge: 10000,
        tax: 14300,
        discount: 0,
        total: 124300,
      });
    });

    it("should subtract a discount from the total without touching the tax base", () => {
      // Arrange & Act
      const totals = calculateOrderTotals([{ unitPrice: 50000, quantity: 2 }], { serviceChargeRate: 0, taxRate: 0 }, 5000);

      // Assert
      expect(totals.total).toBe(95000);
    });
  });
});
