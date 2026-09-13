import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { ArchiveDishUsecase } from "../archive-dish.usecase";

const authUser = buildAuthEntity();

describe("ArchiveDishUsecase", () => {
  let usecase: ArchiveDishUsecase;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveDishUsecase,
        { provide: DishRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(ArchiveDishUsecase);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should archive the dish and take it off the menu", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({
        id: "dish-1",
        restaurantId: authUser.restaurantId,
        name: "Chicken Sekuwa",
        isArchived: false,
      } as any);
      dishRepository.update.mockResolvedValue({ id: "dish-1", isArchived: true } as any);

      // Act
      const result = await usecase.execute("dish-1", authUser);

      // Assert
      expect(result.isArchived).toBe(true);
      expect(dishRepository.update).toHaveBeenCalledWith(
        "dish-1",
        { isArchived: true, isAvailable: false, isFeatured: false },
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith({ action: AuditAction.dish_archived, subject: "Chicken Sekuwa" }, authUser);
    });

    it("should throw ConflictException when it is already archived", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({
        id: "dish-1",
        restaurantId: authUser.restaurantId,
        isArchived: true,
      } as any);

      // Act & Assert
      await expect(usecase.execute("dish-1", authUser)).rejects.toThrow(new ConflictException(DISH_ERROR_MESSAGES.ALREADY_ARCHIVED));
      expect(dishRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the dish is unknown", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("dish-1", authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
