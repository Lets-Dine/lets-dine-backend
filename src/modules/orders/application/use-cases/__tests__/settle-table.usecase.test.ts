import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { SettleTableUsecase } from "../settle-table.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const table = { id: "table-1", restaurantId: authUser.restaurantId, name: "Table 1" };

describe("SettleTableUsecase", () => {
  let usecase: SettleTableUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettleTableUsecase,
        { provide: OrderRepository, useValue: { $transaction: jest.fn(fn => fn(tx)), settleOpenByTableId: jest.fn() } },
        { provide: DiningTableRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(SettleTableUsecase);
    orderRepository = module.get(OrderRepository);
    diningTableRepository = module.get(DiningTableRepository);
    auditLogService = module.get(AuditLogService);

    diningTableRepository.findById.mockResolvedValue(table as any);
  });

  describe("execute", () => {
    it("should close every open order on the table and record it", async () => {
      // Arrange
      const settled = [{ id: "order-1", total: 500, currency: "NPR" }];
      orderRepository.settleOpenByTableId.mockResolvedValue(settled as any);

      // Act
      const result = await usecase.execute("table-1", authUser);

      // Assert
      expect(result).toBe(settled);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.table_settled, subject: "Table 1" }),
        authUser,
        tx
      );
    });

    it("should throw NotFoundException when the table isn't this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND));
    });

    it("should throw ConflictException when the table has no open orders", async () => {
      // Arrange
      orderRepository.settleOpenByTableId.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(new ConflictException(ORDER_ERROR_MESSAGES.NO_OPEN_ORDERS));
    });
  });
});
