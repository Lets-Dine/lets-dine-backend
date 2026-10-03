import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { DISH_VARIANT_ERROR_MESSAGES } from "../../../domain/constants";
import { DishVariantRepository } from "../../../domain/repositories/dish-variant.repository";
import { UpdateDishVariantUsecase } from "../update-dish-variant.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "BBQ Pizza" };
const variant = { id: "variant-1", dishId: dish.id, name: "Large", price: 65000 };

describe("UpdateDishVariantUsecase", () => {
  let usecase: UpdateDishVariantUsecase;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateDishVariantUsecase,
        { provide: DishVariantRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateDishVariantUsecase);
    dishVariantRepository = module.get(DishVariantRepository);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);

    dishRepository.findById.mockResolvedValue(dish as any);
    dishVariantRepository.findById.mockResolvedValue(variant as any);
  });

  describe("execute", () => {
    it("should update the variant", async () => {
      // Arrange
      const dto = { price: 70000 };
      dishVariantRepository.update.mockResolvedValue({ ...variant, ...dto } as any);

      // Act
      const result = await usecase.execute(dish.id, variant.id, dto, authUser);

      // Assert
      expect(result.price).toBe(70000);
      expect(dishVariantRepository.update).toHaveBeenCalledWith(variant.id, dto, { actorId: authUser.sub });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_variant_updated, subject: `${dish.name} — ${variant.name}` }),
        authUser
      );
    });

    it("should throw NotFoundException when the dish belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ ...dish, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, { price: 100 }, authUser)).rejects.toThrow(
        new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(dishVariantRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the variant doesn't belong to this dish", async () => {
      // Arrange
      dishVariantRepository.findById.mockResolvedValue({ ...variant, dishId: "other-dish" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, { price: 100 }, authUser)).rejects.toThrow(
        new NotFoundException(DISH_VARIANT_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(dishVariantRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when there is no such variant", async () => {
      // Arrange
      dishVariantRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute(dish.id, variant.id, { price: 100 }, authUser)).rejects.toThrow(
        new NotFoundException(DISH_VARIANT_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(dishVariantRepository.update).not.toHaveBeenCalled();
    });
  });
});
