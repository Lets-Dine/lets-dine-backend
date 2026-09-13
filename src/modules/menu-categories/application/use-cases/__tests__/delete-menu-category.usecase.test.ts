import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../../domain/constants";
import { MenuCategoryRepository } from "../../../domain/repositories/menu-category.repository";
import { DeleteMenuCategoryUsecase } from "../delete-menu-category.usecase";

const authUser = buildAuthEntity();
const category = { id: "category-1", restaurantId: authUser.restaurantId, name: "Momo" } as any;

describe("DeleteMenuCategoryUsecase", () => {
  let usecase: DeleteMenuCategoryUsecase;
  let menuCategoryRepository: jest.Mocked<MenuCategoryRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteMenuCategoryUsecase,
        {
          provide: MenuCategoryRepository,
          useValue: { findById: jest.fn(), countDishes: jest.fn(), delete: jest.fn() },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(DeleteMenuCategoryUsecase);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should delete an empty category and record it", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue(category);
      menuCategoryRepository.countDishes.mockResolvedValue(0);

      // Act
      await usecase.execute("category-1", authUser);

      // Assert
      expect(menuCategoryRepository.delete).toHaveBeenCalledWith("category-1");
      expect(auditLogService.record).toHaveBeenCalledWith({ action: AuditAction.category_deleted, subject: "Momo" }, authUser);
    });

    it("should throw ConflictException while dishes still point at it", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue(category);
      menuCategoryRepository.countDishes.mockResolvedValue(3);

      // Act & Assert
      await expect(usecase.execute("category-1", authUser)).rejects.toThrow(new ConflictException(MENU_CATEGORY_ERROR_MESSAGES.NOT_EMPTY));
      expect(menuCategoryRepository.delete).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for another restaurant's category", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue({ ...category, restaurantId: "other" });

      // Act & Assert
      await expect(usecase.execute("category-1", authUser)).rejects.toThrow(new NotFoundException(MENU_CATEGORY_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
