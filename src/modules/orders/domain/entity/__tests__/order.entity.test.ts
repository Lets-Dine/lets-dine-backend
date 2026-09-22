import { OrderItemStatus, OrderStatus } from "@prisma/client";
import { IOrder } from "../../interfaces/order.interface";
import { Order } from "../order.entity";

function buildOrder(status: OrderStatus, sessionId = "session-1"): Order {
  return new Order({ status, sessionId } as IOrder);
}

function item(status: OrderItemStatus) {
  return { status };
}

describe("Order", () => {
  describe("canTransitionTo", () => {
    it("should allow the pass to move one stage forward", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PENDING).canTransitionTo(OrderStatus.ACCEPTED)).toBe(true);
      expect(buildOrder(OrderStatus.READY).canTransitionTo(OrderStatus.COMPLETED)).toBe(true);
    });

    it("should refuse skipping a stage or going backwards", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PENDING).canTransitionTo(OrderStatus.READY)).toBe(false);
      expect(buildOrder(OrderStatus.READY).canTransitionTo(OrderStatus.PREPARING)).toBe(false);
    });

    it("should treat completed and cancelled as final", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.COMPLETED).nextStatuses()).toEqual([]);
      expect(buildOrder(OrderStatus.CANCELLED).nextStatuses()).toEqual([]);
    });
  });

  describe("isCancellable", () => {
    it("should stop being cancellable once the food is ready", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PREPARING).isCancellable()).toBe(true);
      expect(buildOrder(OrderStatus.READY).isCancellable()).toBe(false);
    });

    it("should stay cancellable while every item is still untouched", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PREPARING).isCancellable([item(OrderItemStatus.PENDING)])).toBe(true);
      expect(buildOrder(OrderStatus.PREPARING).isCancellable([item(OrderItemStatus.PENDING), item(OrderItemStatus.PENDING)])).toBe(true);
    });

    it("should refuse once a single item has left PENDING, even mid-transition order status", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PREPARING).isCancellable([item(OrderItemStatus.PENDING), item(OrderItemStatus.PREPARING)])).toBe(false);
    });
  });

  describe("hasStartedItems", () => {
    it("should report true once any item has left PENDING", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PREPARING).hasStartedItems([item(OrderItemStatus.PENDING)])).toBe(false);
      expect(buildOrder(OrderStatus.PREPARING).hasStartedItems([item(OrderItemStatus.PREPARING)])).toBe(true);
    });
  });

  describe("isDishReviewable", () => {
    it("should allow rating a dish the moment it's served, even mid-order", () => {
      // Arrange
      const items = [{ dishId: "dish-1", ...item(OrderItemStatus.SERVED) }, { dishId: "dish-2", ...item(OrderItemStatus.PREPARING) }];

      // Act & Assert
      expect(buildOrder(OrderStatus.PREPARING).isDishReviewable(items, "dish-1")).toBe(true);
      expect(buildOrder(OrderStatus.PREPARING).isDishReviewable(items, "dish-2")).toBe(false);
    });

    it("should void a served dish's review once the whole order is cancelled", () => {
      // Arrange
      const items = [{ dishId: "dish-1", ...item(OrderItemStatus.SERVED) }];

      // Act & Assert
      expect(buildOrder(OrderStatus.CANCELLED).isDishReviewable(items, "dish-1")).toBe(false);
    });
  });

  describe("belongsToSession", () => {
    it("should reject another table's session", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PENDING).belongsToSession("session-9")).toBe(false);
    });
  });
});
