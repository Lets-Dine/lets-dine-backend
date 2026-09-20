import { Test, TestingModule } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { FetchOrdersBySessionUsecase } from "../fetch-orders-by-session.usecase";

const authUser = buildAuthEntity();

describe("FetchOrdersBySessionUsecase", () => {
  let usecase: FetchOrdersBySessionUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchOrdersBySessionUsecase, { provide: OrderRepository, useValue: { findBySessionId: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchOrdersBySessionUsecase);
    orderRepository = module.get(OrderRepository);
  });

  describe("execute", () => {
    it("should return every order the repository finds for that session, scoped to the caller's restaurant", async () => {
      // Arrange
      const orders = [{ id: "order-1" }, { id: "order-2" }] as any;
      orderRepository.findBySessionId.mockResolvedValue(orders);

      // Act
      const result = await usecase.execute("session-1", authUser);

      // Assert
      expect(result).toBe(orders);
      expect(orderRepository.findBySessionId).toHaveBeenCalledWith("session-1", authUser.restaurantId);
    });

    it("should return an empty array when the session has no orders", async () => {
      // Arrange
      orderRepository.findBySessionId.mockResolvedValue([]);

      // Act
      const result = await usecase.execute("session-1", authUser);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
