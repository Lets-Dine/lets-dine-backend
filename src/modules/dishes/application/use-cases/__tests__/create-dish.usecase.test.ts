import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../../menu-categories/domain/repositories/menu-category.repository";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { CreateDishUsecase } from "../create-dish.usecase";

const authUser = buildAuthEntity();
const dto = { categoryId: "category-1", name: "Chicken Sekuwa", price: 45000 };

describe("CreateDishUsecase", () => {
  let usecase: CreateDishUsecase;
  let dishRepository: jest.Mocked<DishRepository>;
  let menuCategoryRepository: jest.Mocked<MenuCategoryRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDishUsecase,
        { provide: DishRepository, useValue: { findBySlug: jest.fn(), create: jest.fn() } },
        { provide: MenuCategoryRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateDishUsecase);
    dishRepository = module.get(DishRepository);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should create the dish with a slug derived from its name", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue({
        id: "category-1",
        restaurantId: authUser.restaurantId,
        name: "Grill",
      } as any);
      dishRepository.findBySlug.mockResolvedValue(null);
      dishRepository.create.mockResolvedValue({ id: "dish-1", name: dto.name } as any);

      // Act
      const result = await usecase.execute(dto, authUser);

      // Assert
      expect(result.id).toBe("dish-1");
      expect(dishRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "chicken-sekuwa", restaurantId: authUser.restaurantId, price: 45000 }),
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_created, subject: dto.name }),
        authUser
      );
    });

    it("should throw NotFoundException when the category belongs to another restaurant", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue({ id: "category-1", restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute(dto, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.CATEGORY_NOT_FOUND));
      expect(dishRepository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when another dish already owns that slug", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue({
        id: "category-1",
        restaurantId: authUser.restaurantId,
      } as any);
      dishRepository.findBySlug.mockResolvedValue({ id: "dish-9" } as any);

      // Act & Assert
      await expect(usecase.execute(dto, authUser)).rejects.toThrow(new ConflictException(DISH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS));
      expect(dishRepository.create).not.toHaveBeenCalled();
    });
  });
});
