import { OrderStatus } from "@prisma/client";
import { IOrder } from "../../interfaces/order.interface";
import { Order } from "../order.entity";

function buildOrder(status: OrderStatus, sessionId = "session-1"): Order {
  return new Order({ status, sessionId } as IOrder);
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
  });

  describe("isReviewable", () => {
    it("should only allow reviewing a completed order", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.COMPLETED).isReviewable()).toBe(true);
      expect(buildOrder(OrderStatus.READY).isReviewable()).toBe(false);
    });
  });

  describe("belongsToSession", () => {
    it("should reject another table's session", () => {
      // Arrange & Act & Assert
      expect(buildOrder(OrderStatus.PENDING).belongsToSession("session-9")).toBe(false);
    });
  });
});
