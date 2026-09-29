import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../../tables/domain/constants";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { StartTableSessionUsecase } from "../start-table-session.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const table = { id: "table-1", restaurantId: authUser.restaurantId, name: "Table 1", isActive: true };

describe("StartTableSessionUsecase", () => {
  let usecase: StartTableSessionUsecase;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartTableSessionUsecase,
        {
          provide: DiningTableRepository,
          useValue: { findById: jest.fn(), lockById: jest.fn(), update: jest.fn(), $transaction: jest.fn(fn => fn(tx)) },
        },
        { provide: DiningSessionRepository, useValue: { findOpenByTableId: jest.fn(), create: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(StartTableSessionUsecase);
    diningTableRepository = module.get(DiningTableRepository);
    diningSessionRepository = module.get(DiningSessionRepository);
    auditLogService = module.get(AuditLogService);

    diningTableRepository.findById.mockResolvedValue(table as any);
    diningSessionRepository.findOpenByTableId.mockResolvedValue(null);
  });

  describe("execute", () => {
    it("should seat a free table on the diner's behalf", async () => {
      // Arrange
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);
      const updatedTable = { ...table, currentSessionId: "session-1" };
      diningTableRepository.update.mockResolvedValue(updatedTable as any);

      // Act
      const result = await usecase.execute("table-1", authUser);

      // Assert
      expect(result).toBe(updatedTable);
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created).toMatchObject({ restaurantId: table.restaurantId, tableId: table.id });
      expect(created.anonymousSessionToken).toMatch(/^\d{8}$/);
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(diningTableRepository.update).toHaveBeenCalledWith(table.id, { currentSessionId: "session-1" }, { tx, actorId: authUser.sub });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.table_session_started, subject: table.name }),
        authUser,
        tx
      );
    });

    it("should throw NotFoundException when the table isn't this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND));
      expect(diningSessionRepository.findOpenByTableId).not.toHaveBeenCalled();
    });

    it("should refuse to seat a disabled table", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue({ ...table, isActive: false } as any);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(new ConflictException(DINING_TABLE_ERROR_MESSAGES.INACTIVE));
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should refuse to seat a table that already has an open visit", async () => {
      // Arrange
      diningSessionRepository.findOpenByTableId.mockResolvedValue({ id: "session-existing" } as any);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(
        new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED)
      );
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });
  });
});
