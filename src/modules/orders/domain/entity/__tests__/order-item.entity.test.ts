import { OrderItemStatus, OrderType } from "@prisma/client";
import { IOrderItem } from "../../interfaces/order.interface";
import { OrderItemEntity } from "../order-item.entity";

function buildItem(status: OrderItemStatus, orderType: OrderType = OrderType.DINE_IN): OrderItemEntity {
  return new OrderItemEntity({ status } as IOrderItem, orderType);
}

describe("OrderItemEntity", () => {
  describe("nextStatuses", () => {
    it("should let a dine-in item go all the way to SERVED", () => {
      // Arrange & Act & Assert
      expect(buildItem(OrderItemStatus.READY, OrderType.DINE_IN).canTransitionTo(OrderItemStatus.SERVED)).toBe(true);
    });

    it("should stop a delivery item at READY — the driver takes the whole order at once", () => {
      // Arrange & Act & Assert
      expect(buildItem(OrderItemStatus.READY, OrderType.DELIVERY).canTransitionTo(OrderItemStatus.SERVED)).toBe(false);
      expect(buildItem(OrderItemStatus.READY, OrderType.DELIVERY).nextStatuses()).toEqual([]);
    });

    it("should still let a delivery item move up to READY", () => {
      // Arrange & Act & Assert
      expect(buildItem(OrderItemStatus.PENDING, OrderType.DELIVERY).canTransitionTo(OrderItemStatus.PREPARING)).toBe(true);
      expect(buildItem(OrderItemStatus.PREPARING, OrderType.DELIVERY).canTransitionTo(OrderItemStatus.READY)).toBe(true);
    });
  });
});
