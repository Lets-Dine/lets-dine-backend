import { Test, TestingModule } from "@nestjs/testing";
import { OrderItemStatus, OrderStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { IDiningSession } from "../../../../dining-sessions/domain/interfaces/dining-session.interface";
import { LoyaltyService } from "../../../../loyalty/application/loyalty.service";
import { OrderRepository } from "../../../../orders/domain/repositories/order.repository";
import { DISH_REVIEW_ERROR_MESSAGES } from "../../../domain/constants";
import { DishReviewRepository } from "../../../domain/repositories/dish-review.repository";
import { DishTagRepository } from "../../../domain/repositories/dish-tag.repository";
import { CreateDishReviewUsecase } from "../create-dish-review.usecase";

const session = { id: "session-1", customerId: null } as unknown as IDiningSession;
const dto = {
  orderId: "order-1",
  dishId: "dish-1",
  overall: 5,
  taste: 5,
  portion: 4,
  value: 4,
  wouldOrderAgain: true,
  comment: "Best sekuwa in town",
  tags: ["Juicy"],
};

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    restaurantId: "restaurant-1",
    sessionId: "session-1",
    customerId: "customer-1",
    status: OrderStatus.COMPLETED,
    items: [{ dishId: "dish-1", status: OrderItemStatus.SERVED }],
    ...overrides,
  } as any;
}

describe("CreateDishReviewUsecase", () => {
  let usecase: CreateDishReviewUsecase;
  let dishReviewRepository: jest.Mocked<DishReviewRepository>;
  let dishTagRepository: jest.Mocked<DishTagRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let loyaltyService: jest.Mocked<LoyaltyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDishReviewUsecase,
        { provide: DishReviewRepository, useValue: { findByOrderAndDish: jest.fn(), create: jest.fn() } },
        { provide: DishTagRepository, useValue: { findByLabels: jest.fn().mockResolvedValue([]) } },
        { provide: OrderRepository, useValue: { findById: jest.fn() } },
        { provide: LoyaltyService, useValue: { grantReviewBonus: jest.fn().mockResolvedValue(0) } },
      ],
    }).compile();

    usecase = module.get(CreateDishReviewUsecase);
    dishReviewRepository = module.get(DishReviewRepository);
    dishTagRepository = module.get(DishTagRepository);
    orderRepository = module.get(OrderRepository);
    loyaltyService = module.get(LoyaltyService);
  });

  describe("execute", () => {
    it("should store the review against the order's restaurant and the session", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishTagRepository.findByLabels.mockResolvedValue([{ id: "tag-1", label: "Juicy" } as any]);
      dishReviewRepository.create.mockResolvedValue({ id: "review-1" } as any);

      // Act
      const result = await usecase.execute(dto, session);

      // Assert
      expect(result.id).toBe("review-1");
      expect(dishReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-1",
          sessionId: session.id,
          orderId: "order-1",
          dishId: "dish-1",
          tagIds: ["tag-1"],
        })
      );
    });

    it("should grant the review bonus for the order after the review is saved", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishReviewRepository.create.mockResolvedValue({ id: "review-1" } as any);

      // Act
      const result = await usecase.execute({ ...dto, tags: undefined }, session);

      // Assert
      expect(result).toEqual({ id: "review-1" });
      expect(loyaltyService.grantReviewBonus).toHaveBeenCalledWith({
        id: "order-1",
        restaurantId: "restaurant-1",
        customerId: "customer-1",
      });
    });

    it("should fall back to the session's customer when the order has none", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder({ customerId: null }));
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishReviewRepository.create.mockResolvedValue({ id: "review-1" } as any);

      // Act
      await usecase.execute({ ...dto, tags: undefined }, { ...session, customerId: "customer-9" } as IDiningSession);

      // Assert
      expect(loyaltyService.grantReviewBonus).toHaveBeenCalledWith(expect.objectContaining({ customerId: "customer-9" }));
    });

    it("should still return the review when granting the bonus fails", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishReviewRepository.create.mockResolvedValue({ id: "review-1" } as any);
      loyaltyService.grantReviewBonus.mockRejectedValue(new Error("ledger down"));

      // Act & Assert
      await expect(usecase.execute({ ...dto, tags: undefined }, session)).resolves.toEqual({ id: "review-1" });
    });

    it("should not grant a bonus when the review is refused", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue({ id: "existing" } as any);

      // Act & Assert
      await expect(usecase.execute({ ...dto, tags: undefined }, session)).rejects.toThrow(ConflictException);
      expect(loyaltyService.grantReviewBonus).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the order is another session's", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder({ sessionId: "session-9" }));

      // Act & Assert
      await expect(usecase.execute(dto, session)).rejects.toThrow(new NotFoundException(DISH_REVIEW_ERROR_MESSAGES.ORDER_NOT_FOUND));
    });

    it("should throw BadRequestException while the dish itself is still cooking", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(
        buildOrder({ status: OrderStatus.PREPARING, items: [{ dishId: "dish-1", status: OrderItemStatus.PREPARING }] })
      );

      // Act & Assert
      await expect(usecase.execute(dto, session)).rejects.toThrow(new BadRequestException(DISH_REVIEW_ERROR_MESSAGES.DISH_NOT_SERVED));
      expect(dishReviewRepository.create).not.toHaveBeenCalled();
    });

    it("should allow rating a dish the moment it's served, even while the rest of the order is still cooking", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(
        buildOrder({
          status: OrderStatus.PREPARING,
          items: [
            { dishId: "dish-1", status: OrderItemStatus.SERVED },
            { dishId: "dish-2", status: OrderItemStatus.PREPARING },
          ],
        })
      );
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishTagRepository.findByLabels.mockResolvedValue([{ id: "tag-1", label: "Juicy" } as any]);
      dishReviewRepository.create.mockResolvedValue({ id: "review-1" } as any);

      // Act
      const result = await usecase.execute(dto, session);

      // Assert
      expect(result.id).toBe("review-1");
      expect(dishReviewRepository.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException when the dish was not on that order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder({ items: [{ dishId: "dish-9", status: OrderItemStatus.SERVED }] }));

      // Act & Assert
      await expect(usecase.execute(dto, session)).rejects.toThrow(new BadRequestException(DISH_REVIEW_ERROR_MESSAGES.DISH_NOT_IN_ORDER));
    });

    it("should throw BadRequestException when a whole-order cancel voids a served dish's review", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder({ status: OrderStatus.CANCELLED }));

      // Act & Assert
      await expect(usecase.execute(dto, session)).rejects.toThrow(new BadRequestException(DISH_REVIEW_ERROR_MESSAGES.DISH_NOT_SERVED));
      expect(dishReviewRepository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException on a second rating of the same dish", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue({ id: "review-0" } as any);

      // Act & Assert
      await expect(usecase.execute(dto, session)).rejects.toThrow(new ConflictException(DISH_REVIEW_ERROR_MESSAGES.ALREADY_REVIEWED));
    });

    it("should throw BadRequestException for a tag outside the vocabulary", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder());
      dishReviewRepository.findByOrderAndDish.mockResolvedValue(null);
      dishTagRepository.findByLabels.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ ...dto, tags: ["Invented"] }, session)).rejects.toThrow(
        new BadRequestException(DISH_REVIEW_ERROR_MESSAGES.UNKNOWN_TAG)
      );
      expect(dishReviewRepository.create).not.toHaveBeenCalled();
    });
  });
});
