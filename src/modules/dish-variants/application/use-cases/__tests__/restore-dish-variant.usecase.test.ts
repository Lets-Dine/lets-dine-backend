import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { DISH_VARIANT_ERROR_MESSAGES } from "../../../domain/constants";
import { DishVariantRepository } from "../../../domain/repositories/dish-variant.repository";
import { RestoreDishVariantUsecase } from "../restore-dish-variant.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, name: "BBQ Pizza" };
const variant = { id: "variant-1", dishId: dish.id, name: "Large", isArchived: true };

describe("RestoreDishVariantUsecase", () => {
  let usecase: RestoreDishVariantUsecase;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreDishVariantUsecase,
        { provide: DishVariantRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(RestoreDishVariantUsecase);
    dishVariantRepository = module.get(DishVariantRepository);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);

    dishRepository.findById.mockResolvedValue(dish as any);
    dishVariantRepository.findById.mockResolvedValue(variant as any);
  });

  describe("execute", () => {
    it("should restore the variant, still unavailable", async () => {
      // Arrange
      dishVariantRepository.update.mockResolvedValue({ ...variant, isArchived: false } as any);

      // Act
      await usecase.execute(dish.id, variant.id, authUser);

      // Assert
      expect(dishVariantRepository.update).toHaveBeenCalledWith(variant.id, { isArchived: false }, { actorId: authUser.sub });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_variant_restored, subject: `${dish.name} — ${variant.name}` }),
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

    it("should throw ConflictException when not archived", async () => {
      // Arrange
      dishVariantRepository.findById.mockResolvedValue({ ...variant, isArchived: false } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, authUser)).rejects.toThrow(
        new ConflictException(DISH_VARIANT_ERROR_MESSAGES.NOT_ARCHIVED)
      );
    });
  });
});
