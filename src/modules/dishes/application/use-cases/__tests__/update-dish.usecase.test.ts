import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../../../common/constants";
import { ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../../menu-categories/domain/repositories/menu-category.repository";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { IDish } from "../../../domain/interfaces/dish.interface";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { UpdateDishUsecase } from "../update-dish.usecase";

const authUser = buildAuthEntity();

function buildDish(overrides: Partial<IDish> = {}): IDish {
  return {
    id: "dish-1",
    restaurantId: authUser.restaurantId,
    categoryId: "category-1",
    name: "Chicken Sekuwa",
    slug: "chicken-sekuwa",
    description: "",
    imageUrl: null,
    price: 45000,
    isAvailable: true,
    isArchived: false,
    isFeatured: false,
    sortOrder: 0,
    spiceLevel: 1,
    isVeg: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("UpdateDishUsecase", () => {
  let usecase: UpdateDishUsecase;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateDishUsecase,
        { provide: DishRepository, useValue: { findById: jest.fn(), findBySlug: jest.fn(), update: jest.fn() } },
        { provide: MenuCategoryRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateDishUsecase);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should record a price change with both prices", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(buildDish());
      dishRepository.update.mockResolvedValue(buildDish({ price: 48000 }));

      // Act
      const result = await usecase.execute("dish-1", { price: 48000 }, authUser);

      // Assert
      expect(result.price).toBe(48000);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.price_changed, detail: "45000 → 48000" }),
        authUser
      );
    });

    it("should record an availability flip", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(buildDish());
      dishRepository.update.mockResolvedValue(buildDish({ isAvailable: false }));

      // Act
      await usecase.execute("dish-1", { isAvailable: false }, authUser);

      // Assert
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.availability_changed }), authUser);
    });

    it("should refuse a price change from a role without menu:price", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(buildDish());

      // Act & Assert
      await expect(usecase.execute("dish-1", { price: 48000 }, buildAuthEntity({ role: StaffRole.STAFF }))).rejects.toThrow(
        new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN)
      );
      expect(dishRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for a dish of another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(buildDish({ restaurantId: "other" }));

      // Act & Assert
      await expect(usecase.execute("dish-1", { isAvailable: false }, authUser)).rejects.toThrow(
        new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND)
      );
    });
  });
});
