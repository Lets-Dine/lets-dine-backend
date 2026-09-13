import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../domain/constants";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";
import { MenuCategoryRepository } from "../../domain/repositories/menu-category.repository";
import { ReorderMenuCategoriesInput } from "../../interfaces/http/validations/reorder-menu-categories.validation";

/** The whole new order is applied in one transaction — a half-applied menu order is worse than none. */
@Injectable()
export class ReorderMenuCategoriesUsecase {
  constructor(
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: ReorderMenuCategoriesInput, authEntity: AuthEntity): Promise<IMenuCategory[]> {
    const categories = await this.menuCategoryRepository.$transaction(async tx => {
      const updated: IMenuCategory[] = [];

      for (const item of dto.items) {
        const existing = await this.menuCategoryRepository.findById(item.id, { tx });
        if (!existing || existing.restaurantId !== authEntity.restaurantId) {
          throw new NotFoundException({ ...MENU_CATEGORY_ERROR_MESSAGES.NOT_FOUND, detail: { id: item.id } });
        }

        updated.push(await this.menuCategoryRepository.update(item.id, { sortOrder: item.sortOrder }, { tx, actorId: authEntity.sub }));
      }

      return updated;
    });

    await this.auditLogService.record(
      {
        action: AuditAction.category_reordered,
        subject: "Menu categories",
        detail: categories.map(category => category.name).join(", "),
      },
      authEntity
    );

    return categories;
  }
}
