import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../domain/constants";
import { IDiningTable } from "../../../domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../../domain/repositories/dining-table.repository";
import { UpdateTableUsecase } from "../update-table.usecase";

const authUser = buildAuthEntity();

function buildTable(overrides: Partial<IDiningTable> = {}): IDiningTable {
  return {
    id: "table-1",
    restaurantId: authUser.restaurantId,
    name: "T1",
    qrToken: "token",
    capacity: 4,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("UpdateTableUsecase", () => {
  let usecase: UpdateTableUsecase;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateTableUsecase,
        { provide: DiningTableRepository, useValue: { findById: jest.fn(), findByName: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateTableUsecase);
    diningTableRepository = module.get(DiningTableRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should rename the table and record the rename", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(buildTable());
      diningTableRepository.findByName.mockResolvedValue(null);
      diningTableRepository.update.mockResolvedValue(buildTable({ name: "Window 2" }));

      // Act
      const result = await usecase.execute("table-1", { name: "Window 2" }, authUser);

      // Assert
      expect(result.name).toBe("Window 2");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.table_renamed, detail: "T1 → Window 2" }),
        authUser
      );
    });

    it("should record a disable so the QR going dead is traceable", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(buildTable());
      diningTableRepository.update.mockResolvedValue(buildTable({ isActive: false }));

      // Act
      await usecase.execute("table-1", { isActive: false }, authUser);

      // Assert
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.table_disabled }), authUser);
    });

    it("should throw NotFoundException for a table of another restaurant", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(buildTable({ restaurantId: "other" }));

      // Act & Assert
      await expect(usecase.execute("table-1", { capacity: 6 }, authUser)).rejects.toThrow(
        new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(diningTableRepository.update).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when renaming onto an existing name", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(buildTable());
      diningTableRepository.findByName.mockResolvedValue(buildTable({ id: "table-2", name: "T2" }));

      // Act & Assert
      await expect(usecase.execute("table-1", { name: "T2" }, authUser)).rejects.toThrow(
        new ConflictException(DINING_TABLE_ERROR_MESSAGES.NAME_ALREADY_EXISTS)
      );
      expect(diningTableRepository.update).not.toHaveBeenCalled();
    });
  });
});
