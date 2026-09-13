import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../../domain/constants";
import { MenuCategoryRepository } from "../../../domain/repositories/menu-category.repository";
import { CreateMenuCategoryUsecase } from "../create-menu-category.usecase";

const authUser = buildAuthEntity();

describe("CreateMenuCategoryUsecase", () => {
  let usecase: CreateMenuCategoryUsecase;
  let menuCategoryRepository: jest.Mocked<MenuCategoryRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateMenuCategoryUsecase,
        { provide: MenuCategoryRepository, useValue: { findByName: jest.fn(), create: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateMenuCategoryUsecase);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should create the category under the token's restaurant", async () => {
      // Arrange
      const category = { id: "category-1", name: "Momo" } as any;
      menuCategoryRepository.findByName.mockResolvedValue(null);
      menuCategoryRepository.create.mockResolvedValue(category);

      // Act
      const result = await usecase.execute({ name: "Momo", emoji: "🥟" }, authUser);

      // Assert
      expect(result).toBe(category);
      expect(menuCategoryRepository.create).toHaveBeenCalledWith(
        { name: "Momo", emoji: "🥟", restaurantId: authUser.restaurantId },
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith({ action: AuditAction.category_created, subject: "Momo" }, authUser);
    });

    it("should throw ConflictException when the name is taken", async () => {
      // Arrange
      menuCategoryRepository.findByName.mockResolvedValue({ id: "category-9" } as any);

      // Act & Assert
      await expect(usecase.execute({ name: "Momo" }, authUser)).rejects.toThrow(
        new ConflictException(MENU_CATEGORY_ERROR_MESSAGES.NAME_ALREADY_EXISTS)
      );
      expect(menuCategoryRepository.create).not.toHaveBeenCalled();
    });
  });
});
