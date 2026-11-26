import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../menu-categories/domain/repositories/menu-category.repository";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IMenuCategory } from "../../../menu-categories/domain/interfaces/menu-category.interface";
import { IDish } from "../../domain/interfaces/dish.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";
import { slugify } from "../../domain/utils/slug.util";
import { CreateDishInput } from "../../interfaces/http/validations/create-dish.validation";

const UNCATEGORIZED = "Uncategorized";

@Injectable()
export class CreateDishUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateDishInput, authEntity: AuthEntity): Promise<IDish> {
    const category = dto.categoryId ? await this.menuCategoryRepository.findById(dto.categoryId) : await this.uncategorized(authEntity);
    if (!category || !isInActiveBranch(authEntity, category)) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    const slug = slugify(dto.name);
    const clash = await this.dishRepository.findBySlug(authEntity.branchId, slug);
    if (clash) throw new ConflictException(DISH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);

    const dish = await this.dishRepository.create(
      { ...dto, categoryId: category.id, slug, restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.dish_created, subject: dish.name, detail: `In ${category.name}` }, authEntity);

    return dish;
  }

  /** The branch's catch-all section, created on first use and kept last in the menu. */
  private async uncategorized(authEntity: AuthEntity): Promise<IMenuCategory> {
    const existing = await this.menuCategoryRepository.findByName(authEntity.branchId, UNCATEGORIZED);
    if (existing) return existing;

    const { rows } = await this.menuCategoryRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      { sortBy: "sortOrder", sortOrder: "desc", limit: 1, returnCount: false }
    );
    // ponytail: two first-ever dishes saved at the exact same moment can race on the unique name; retry fixes it.
    return this.menuCategoryRepository.create(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, name: UNCATEGORIZED, sortOrder: (rows[0]?.sortOrder ?? -1) + 1 },
      { actorId: authEntity.sub }
    );
  }
}
