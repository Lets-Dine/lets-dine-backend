import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { ADD_ON_ERROR_MESSAGES } from "../../../domain/constants";
import { AddOnRepository } from "../../../domain/repositories/add-on.repository";
import { ArchiveAddOnUsecase } from "../archive-add-on.usecase";

const authUser = buildAuthEntity();
const addOn = { id: "addon-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Extra Cheese", isArchived: false };

describe("ArchiveAddOnUsecase", () => {
  let usecase: ArchiveAddOnUsecase;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveAddOnUsecase,
        { provide: AddOnRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(ArchiveAddOnUsecase);
    addOnRepository = module.get(AddOnRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should archive the add-on and mark it unavailable", async () => {
      // Arrange
      addOnRepository.findById.mockResolvedValue(addOn as any);
      addOnRepository.update.mockResolvedValue({ ...addOn, isArchived: true, isAvailable: false } as any);

      // Act
      await usecase.execute("addon-1", authUser);

      // Assert
      expect(addOnRepository.update).toHaveBeenCalledWith("addon-1", { isArchived: true, isAvailable: false }, { actorId: authUser.sub });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.addon_archived, subject: addOn.name }),
        authUser
      );
    });

    it("should throw NotFoundException when the add-on belongs to another restaurant", async () => {
      // Arrange
      addOnRepository.findById.mockResolvedValue({ ...addOn, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute("addon-1", authUser)).rejects.toThrow(new NotFoundException(ADD_ON_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw ConflictException when already archived", async () => {
      // Arrange
      addOnRepository.findById.mockResolvedValue({ ...addOn, isArchived: true } as any);

      // Act & Assert
      await expect(usecase.execute("addon-1", authUser)).rejects.toThrow(new ConflictException(ADD_ON_ERROR_MESSAGES.ALREADY_ARCHIVED));
    });
  });
});
