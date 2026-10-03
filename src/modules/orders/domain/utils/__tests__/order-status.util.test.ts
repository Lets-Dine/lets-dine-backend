import { OrderItemStatus, OrderType } from "@prisma/client";
import { deriveOrderStatus } from "../order-status.util";

function item(status: OrderItemStatus) {
  return { status };
}

describe("deriveOrderStatus", () => {
  it("should derive COMPLETED for a dine-in order once every item is served", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null, OrderType.DINE_IN)).toBe("COMPLETED");
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null)).toBe("COMPLETED");
  });

  it("should cap a delivery order at READY instead of auto-completing — only the manual steps progress it further", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null, OrderType.DELIVERY)).toBe("READY");
  });

  it("should still derive CANCELLED for a delivery order once every item is cancelled", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.CANCELLED)], null, OrderType.DELIVERY)).toBe("CANCELLED");
  });

  it("should derive UNPAID for a floor order once every item is served but nothing is paid yet", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null, OrderType.DINE_IN, { isFloorOrder: true })).toBe("UNPAID");
  });

  it("should derive COMPLETED for a floor order once every item is served and it's been paid", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null, OrderType.DINE_IN, { isFloorOrder: true, paidAt: new Date() })).toBe(
      "COMPLETED"
    );
  });

  it("should never gate a table order on payment — UNPAID is floor-only", () => {
    // Arrange & Act & Assert
    expect(deriveOrderStatus([item(OrderItemStatus.SERVED)], null, OrderType.DINE_IN, { isFloorOrder: false })).toBe("COMPLETED");
  });
});
