import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MENU_CATEGORY_ERROR_MESSAGES } from "../../domain/constants";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";
import { MenuCategoryRepository } from "../../domain/repositories/menu-category.repository";
import { CreateMenuCategoryInput } from "../../interfaces/http/validations/create-menu-category.validation";

@Injectable()
export class CreateMenuCategoryUsecase {
  constructor(
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateMenuCategoryInput, authEntity: AuthEntity): Promise<IMenuCategory> {
    const existing = await this.menuCategoryRepository.findByName(authEntity.restaurantId, dto.name);
    if (existing) throw new ConflictException(MENU_CATEGORY_ERROR_MESSAGES.NAME_ALREADY_EXISTS);

    const category = await this.menuCategoryRepository.create(
      { ...dto, restaurantId: authEntity.restaurantId },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.category_created, subject: category.name }, authEntity);

    return category;
  }
}
