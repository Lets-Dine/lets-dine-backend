import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { DISH_VARIANT_ERROR_MESSAGES } from "../../../domain/constants";
import { DishVariantRepository } from "../../../domain/repositories/dish-variant.repository";
import { ArchiveDishVariantUsecase } from "../archive-dish-variant.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, name: "BBQ Pizza" };
const variant = { id: "variant-1", dishId: dish.id, name: "Large", isArchived: false };

describe("ArchiveDishVariantUsecase", () => {
  let usecase: ArchiveDishVariantUsecase;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveDishVariantUsecase,
        { provide: DishVariantRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(ArchiveDishVariantUsecase);
    dishVariantRepository = module.get(DishVariantRepository);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);

    dishRepository.findById.mockResolvedValue(dish as any);
    dishVariantRepository.findById.mockResolvedValue(variant as any);
  });

  describe("execute", () => {
    it("should archive the variant and mark it unavailable", async () => {
      // Arrange
      dishVariantRepository.update.mockResolvedValue({ ...variant, isArchived: true, isAvailable: false } as any);

      // Act
      await usecase.execute(dish.id, variant.id, authUser);

      // Assert
      expect(dishVariantRepository.update).toHaveBeenCalledWith(
        variant.id,
        { isArchived: true, isAvailable: false },
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_variant_archived, subject: `${dish.name} — ${variant.name}` }),
        authUser
      );
    });

    it("should throw NotFoundException when the dish belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ ...dish, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw NotFoundException when the variant doesn't belong to this dish", async () => {
      // Arrange
      dishVariantRepository.findById.mockResolvedValue({ ...variant, dishId: "other-dish" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, authUser)).rejects.toThrow(
        new NotFoundException(DISH_VARIANT_ERROR_MESSAGES.NOT_FOUND)
      );
    });

    it("should throw ConflictException when already archived", async () => {
      // Arrange
      dishVariantRepository.findById.mockResolvedValue({ ...variant, isArchived: true } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, authUser)).rejects.toThrow(
        new ConflictException(DISH_VARIANT_ERROR_MESSAGES.ALREADY_ARCHIVED)
      );
    });
  });
});
