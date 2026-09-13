import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../menu-categories/domain/repositories/menu-category.repository";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDish } from "../../domain/interfaces/dish.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";
import { slugify } from "../../domain/utils/slug.util";
import { CreateDishInput } from "../../interfaces/http/validations/create-dish.validation";

@Injectable()
export class CreateDishUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateDishInput, authEntity: AuthEntity): Promise<IDish> {
    const category = await this.menuCategoryRepository.findById(dto.categoryId);
    if (!category || category.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    const slug = slugify(dto.name);
    const clash = await this.dishRepository.findBySlug(authEntity.restaurantId, slug);
    if (clash) throw new ConflictException(DISH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);

    const dish = await this.dishRepository.create({ ...dto, slug, restaurantId: authEntity.restaurantId }, { actorId: authEntity.sub });

    await this.auditLogService.record({ action: AuditAction.dish_created, subject: dish.name, detail: `In ${category.name}` }, authEntity);

    return dish;
  }
}
