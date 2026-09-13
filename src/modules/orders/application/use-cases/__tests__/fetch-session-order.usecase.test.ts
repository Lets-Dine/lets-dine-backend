import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { IDiningSession } from "../../../../dining-sessions/domain/interfaces/dining-session.interface";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { FetchSessionOrderUsecase } from "../fetch-session-order.usecase";

const session = { id: "session-1" } as IDiningSession;

describe("FetchSessionOrderUsecase", () => {
  let usecase: FetchSessionOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchSessionOrderUsecase, { provide: OrderRepository, useValue: { findById: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchSessionOrderUsecase);
    orderRepository = module.get(OrderRepository);
  });

  describe("execute", () => {
    it("should return the order placed by this session", async () => {
      // Arrange
      const order = { id: "order-1", sessionId: "session-1" } as any;
      orderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await usecase.execute("order-1", session);

      // Assert
      expect(result).toBe(order);
    });

    it("should hide an order belonging to another table's session", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue({ id: "order-1", sessionId: "session-9" } as any);

      // Act & Assert
      await expect(usecase.execute("order-1", session)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
