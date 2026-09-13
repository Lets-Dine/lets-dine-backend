import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { can } from "../../../../common/auth";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../menu-categories/domain/repositories/menu-category.repository";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDish } from "../../domain/interfaces/dish.interface";
import { DishRepository, IDishUpdate } from "../../domain/repositories/dish.repository";
import { slugify } from "../../domain/utils/slug.util";
import { UpdateDishInput } from "../../interfaces/http/validations/update-dish.validation";

@Injectable()
export class UpdateDishUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateDishInput, authEntity: AuthEntity): Promise<IDish> {
    const existing = await this.dishRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    // §50 — changing a price is a separate permission from editing the dish.
    if (dto.price !== undefined && dto.price !== existing.price && !can(authEntity.role, "menu:price")) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.menuCategoryRepository.findById(dto.categoryId);
      if (!category || category.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(DISH_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }
    }

    const patch: IDishUpdate = { ...dto };

    if (dto.name && dto.name !== existing.name) {
      patch.slug = slugify(dto.name);
      const clash = await this.dishRepository.findBySlug(authEntity.restaurantId, patch.slug);
      if (clash && clash.id !== id) throw new ConflictException(DISH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);
    }

    const updated = await this.dishRepository.update(id, patch, { actorId: authEntity.sub });

    await this.recordChanges(existing, updated, dto, authEntity);

    return updated;
  }

  /** §51 — a price change and an availability flip are their own audit actions. */
  private async recordChanges(before: IDish, after: IDish, dto: UpdateDishInput, authEntity: AuthEntity): Promise<void> {
    if (dto.price !== undefined && dto.price !== before.price) {
      await this.auditLogService.record(
        { action: AuditAction.price_changed, subject: after.name, detail: `${before.price} → ${after.price}` },
        authEntity
      );
    }

    if (dto.isAvailable !== undefined && dto.isAvailable !== before.isAvailable) {
      await this.auditLogService.record(
        {
          action: AuditAction.availability_changed,
          subject: after.name,
          detail: dto.isAvailable ? "Back on the menu" : "Marked unavailable",
        },
        authEntity
      );
    }

    if (dto.isFeatured !== undefined && dto.isFeatured !== before.isFeatured) {
      await this.auditLogService.record(
        {
          action: AuditAction.dish_featured,
          subject: after.name,
          detail: dto.isFeatured ? "Marked a staff pick" : "No longer a staff pick",
        },
        authEntity
      );
    }

    const onlyFlags = ["price", "isAvailable", "isFeatured"];
    const changedFields = Object.keys(dto).filter(field => !onlyFlags.includes(field));
    if (changedFields.length > 0) {
      await this.auditLogService.record(
        { action: AuditAction.dish_updated, subject: after.name, detail: `Changed: ${changedFields.join(", ")}` },
        authEntity
      );
    }
  }
}
