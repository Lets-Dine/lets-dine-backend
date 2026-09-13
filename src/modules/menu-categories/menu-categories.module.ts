import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CreateMenuCategoryUsecase } from "./application/use-cases/create-menu-category.usecase";
import { DeleteMenuCategoryUsecase } from "./application/use-cases/delete-menu-category.usecase";
import { FetchAllMenuCategoriesUsecase } from "./application/use-cases/fetch-all-menu-categories.usecase";
import { ReorderMenuCategoriesUsecase } from "./application/use-cases/reorder-menu-categories.usecase";
import { UpdateMenuCategoryUsecase } from "./application/use-cases/update-menu-category.usecase";
import { MenuCategoryRepository } from "./domain/repositories/menu-category.repository";
import MenuCategoryRepositoryImpl from "./infrastructure/repositories/menu-category.repository.impl";
import { MenuCategoryController } from "./interfaces/http/menu-category.controller";

@Module({
  imports: [AuditLogsModule],
  controllers: [MenuCategoryController],
  providers: [
    CreateMenuCategoryUsecase,
    UpdateMenuCategoryUsecase,
    DeleteMenuCategoryUsecase,
    ReorderMenuCategoriesUsecase,
    FetchAllMenuCategoriesUsecase,
    MenuCategoryRepositoryImpl,
    { provide: MenuCategoryRepository, useExisting: MenuCategoryRepositoryImpl },
  ],
  exports: [{ provide: MenuCategoryRepository, useExisting: MenuCategoryRepositoryImpl }],
})
export class MenuCategoriesModule {}
