import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../domain/constants";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";
import { MenuCategoryRepository } from "../../domain/repositories/menu-category.repository";
import { UpdateMenuCategoryInput } from "../../interfaces/http/validations/update-menu-category.validation";

@Injectable()
export class UpdateMenuCategoryUsecase {
  constructor(
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateMenuCategoryInput, authEntity: AuthEntity): Promise<IMenuCategory> {
    const existing = await this.menuCategoryRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(MENU_CATEGORY_ERROR_MESSAGES.NOT_FOUND);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.menuCategoryRepository.findByName(authEntity.restaurantId, dto.name);
      if (clash) throw new ConflictException(MENU_CATEGORY_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
    }

    const updated = await this.menuCategoryRepository.update(id, dto, { actorId: authEntity.sub });

    if (dto.name && dto.name !== existing.name) {
      await this.auditLogService.record(
        { action: AuditAction.category_renamed, subject: dto.name, detail: `${existing.name} → ${dto.name}` },
        authEntity
      );
    }

    return updated;
  }
}
