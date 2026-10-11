import { buildAuthEntity } from "../../../../../common/testing";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { CompleteDeliveryUsecase } from "../complete-delivery.usecase";

const authUser = buildAuthEntity();
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

describe("CompleteDeliveryUsecase", () => {
  describe("execute", () => {
    it("should close the open run with the cash that came back", async () => {
      // Arrange
      const repo = {
        findOpenAssignment: jest.fn().mockResolvedValue({ id: "run-1" }),
        completeAssignment: jest.fn().mockResolvedValue({ id: "run-1", status: "DELIVERED", cashCollected: 90000 }),
      };
      const usecase = new CompleteDeliveryUsecase(repo as unknown as DeliveryRepository);

      // Act
      const result = await usecase.execute(ORDER_ID, { cashCollected: 90000 }, authUser);

      // Assert
      expect(repo.findOpenAssignment).toHaveBeenCalledWith({ restaurantId: authUser.restaurantId, branchId: authUser.branchId }, ORDER_ID);
      expect(repo.completeAssignment).toHaveBeenCalledWith("run-1", 90000, authUser.sub);
      expect(result).toMatchObject({ status: "DELIVERED" });
    });

    it("should answer null when the order was sent out with no courier recorded", async () => {
      // Arrange
      const repo = { findOpenAssignment: jest.fn().mockResolvedValue(null), completeAssignment: jest.fn() };
      const usecase = new CompleteDeliveryUsecase(repo as unknown as DeliveryRepository);

      // Act
      const result = await usecase.execute(ORDER_ID, { cashCollected: 0 }, authUser);

      // Assert
      expect(result).toBeNull();
      expect(repo.completeAssignment).not.toHaveBeenCalled();
    });
  });
});
