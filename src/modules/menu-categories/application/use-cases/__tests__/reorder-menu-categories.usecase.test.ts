import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../../domain/constants";
import { MenuCategoryRepository } from "../../../domain/repositories/menu-category.repository";
import { ReorderMenuCategoriesUsecase } from "../reorder-menu-categories.usecase";

const authUser = buildAuthEntity();

describe("ReorderMenuCategoriesUsecase", () => {
  let usecase: ReorderMenuCategoriesUsecase;
  let menuCategoryRepository: jest.Mocked<MenuCategoryRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReorderMenuCategoriesUsecase,
        {
          provide: MenuCategoryRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn({} as PrismaTransaction)),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(ReorderMenuCategoriesUsecase);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should apply every new position and record the new order", async () => {
      // Arrange
      menuCategoryRepository.findById.mockImplementation(
        async id => ({ id, restaurantId: authUser.restaurantId, name: `Category ${id}` }) as any
      );
      menuCategoryRepository.update.mockImplementation(async id => ({ id, name: `Category ${id}` }) as any);

      // Act
      const result = await usecase.execute(
        {
          items: [
            { id: "a", sortOrder: 0 },
            { id: "b", sortOrder: 1 },
          ],
        },
        authUser
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(menuCategoryRepository.update).toHaveBeenCalledTimes(2);
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.category_reordered }), authUser);
    });

    it("should throw NotFoundException when one id is not this restaurant's", async () => {
      // Arrange
      menuCategoryRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ items: [{ id: "a", sortOrder: 0 }] }, authUser)).rejects.toThrow(
        new NotFoundException(MENU_CATEGORY_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
