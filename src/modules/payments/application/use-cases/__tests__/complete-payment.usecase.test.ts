import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DiningSessionService } from "../../../../dining-sessions/application/dining-session.service";
import { DiningSessionRepository } from "../../../../dining-sessions/domain/repositories/dining-session.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { PAYMENT_ERROR_MESSAGES } from "../../../domain/constants";
import { PaymentRepository } from "../../../domain/repositories/payment.repository";
import { CompletePaymentUsecase } from "../complete-payment.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const session = { id: "session-1", restaurantId: authUser.restaurantId, tableId: "table-1", endedAt: null };
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, name: "Momo", price: 200 };
const requestItems = [{ dishId: "dish-1", quantity: 2 }];

describe("CompletePaymentUsecase", () => {
  let usecase: CompletePaymentUsecase;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let diningSessionService: jest.Mocked<DiningSessionService>;
  let dishRepository: jest.Mocked<DishRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletePaymentUsecase,
        { provide: PaymentRepository, useValue: { $transaction: jest.fn(fn => fn(tx)), create: jest.fn() } },
        { provide: DiningSessionRepository, useValue: { findById: jest.fn() } },
        { provide: DiningSessionService, useValue: { endSession: jest.fn() } },
        { provide: DishRepository, useValue: { findManyByIds: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CompletePaymentUsecase);
    paymentRepository = module.get(PaymentRepository);
    diningSessionRepository = module.get(DiningSessionRepository);
    diningSessionService = module.get(DiningSessionService);
    dishRepository = module.get(DishRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);

    diningSessionRepository.findById.mockResolvedValue(session as any);
    restaurantRepository.findById.mockResolvedValue(restaurant as any);
    dishRepository.findManyByIds.mockResolvedValue([dish] as any);
  });

  describe("execute", () => {
    it("should charge for exactly the items the cashier sent, priced fresh off the dish", async () => {
      // Arrange
      const payment = { id: "payment-1", total: 452, currency: "NPR" };
      paymentRepository.create.mockResolvedValue(payment as any);

      // Act
      const result = await usecase.execute({ sessionId: "session-1", items: requestItems }, authUser);

      // Assert
      expect(result).toBe(payment);
      const [createArgs] = paymentRepository.create.mock.calls[0];
      expect(createArgs.sessionId).toBe("session-1");
      expect(createArgs.tableId).toBe("table-1");
      expect(createArgs.subtotal).toBe(400);
      expect(createArgs.items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo", unitPrice: 200, quantity: 2 }]);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.payment_completed, subject: "Session session-1" }),
        authUser,
        tx
      );
      expect(diningSessionService.endSession).not.toHaveBeenCalled();
    });

    it("should hand the session off to the shared end-session service when asked", async () => {
      // Arrange
      paymentRepository.create.mockResolvedValue({ id: "payment-1", total: 452, currency: "NPR" } as any);

      // Act
      await usecase.execute({ sessionId: "session-1", items: requestItems, endSession: true }, authUser);

      // Assert
      expect(diningSessionService.endSession).toHaveBeenCalledWith(session, authUser, tx);
    });

    it("should throw NotFoundException when the session isn't this restaurant's", async () => {
      // Arrange
      diningSessionRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems }, authUser)).rejects.toThrow(
        new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND)
      );
    });

    it("should throw ConflictException when the session has already ended", async () => {
      // Arrange
      diningSessionRepository.findById.mockResolvedValue({ ...session, endedAt: new Date() } as any);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems }, authUser)).rejects.toThrow(
        new ConflictException(PAYMENT_ERROR_MESSAGES.SESSION_ALREADY_ENDED)
      );
    });

    it("should throw NotFoundException when a charged dish isn't on this restaurant's menu", async () => {
      // Arrange
      dishRepository.findManyByIds.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems }, authUser)).rejects.toThrow(NotFoundException);
    });
  });
});
