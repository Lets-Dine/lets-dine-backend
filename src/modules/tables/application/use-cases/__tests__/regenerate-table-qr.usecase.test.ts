import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningTableRepository } from "../../../domain/repositories/dining-table.repository";
import { RegenerateTableQrUsecase } from "../regenerate-table-qr.usecase";

const authUser = buildAuthEntity();

describe("RegenerateTableQrUsecase", () => {
  let usecase: RegenerateTableQrUsecase;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegenerateTableQrUsecase,
        { provide: DiningTableRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(RegenerateTableQrUsecase);
    diningTableRepository = module.get(DiningTableRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should replace the token with a different one and record the rotation", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue({
        id: "table-1",
        restaurantId: authUser.restaurantId,
        name: "T1",
        qrToken: "old-token",
      } as any);
      diningTableRepository.update.mockResolvedValue({ id: "table-1", qrToken: "new-token" } as any);

      // Act
      const result = await usecase.execute("table-1", authUser);

      // Assert
      expect(result.qrToken).toBe("new-token");
      const [, patch] = diningTableRepository.update.mock.calls[0];
      expect(patch.qrToken).not.toBe("old-token");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.qr_regenerated, subject: "T1" }),
        authUser
      );
    });

    it("should throw NotFoundException when the table is not this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND));
      expect(diningTableRepository.update).not.toHaveBeenCalled();
    });
  });
});
