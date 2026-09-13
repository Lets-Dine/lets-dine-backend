import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";
import { MenuCategoryRepository } from "../../domain/repositories/menu-category.repository";
import { FetchMenuCategoriesQuery } from "../../interfaces/http/validations/fetch-menu-categories.validation";

@Injectable()
export class FetchAllMenuCategoriesUsecase {
  constructor(private readonly menuCategoryRepository: MenuCategoryRepository) {}

  async execute(query: FetchMenuCategoriesQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IMenuCategory>> {
    const { keyword, ...pagination } = query;
    return this.menuCategoryRepository.fetchAll({ restaurantId: authEntity.restaurantId, keyword }, pagination);
  }
}
