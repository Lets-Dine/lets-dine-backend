import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../domain/constants";
import { MenuCategoryRepository } from "../../domain/repositories/menu-category.repository";

/** §28 — a category is only removable once it holds no dishes, archived or not. */
@Injectable()
export class DeleteMenuCategoryUsecase {
  constructor(
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const existing = await this.menuCategoryRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(MENU_CATEGORY_ERROR_MESSAGES.NOT_FOUND);
    }

    const dishCount = await this.menuCategoryRepository.countDishes(id);
    if (dishCount > 0) {
      throw new ConflictException({
        ...MENU_CATEGORY_ERROR_MESSAGES.NOT_EMPTY,
        detail: { dishCount },
      });
    }

    await this.menuCategoryRepository.delete(id);

    await this.auditLogService.record({ action: AuditAction.category_deleted, subject: existing.name }, authEntity);
  }
}
