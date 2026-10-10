import { Test } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { MenuCategoryRepository } from "../../../../menu-categories/domain/repositories/menu-category.repository";
import { DishStatsService } from "../../dish-stats.service";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { ArchiveDishUsecase } from "../archive-dish.usecase";
import { CreateDishUsecase } from "../create-dish.usecase";
import { FetchAllDishesUsecase } from "../fetch-all-dishes.usecase";
import { UpdateDishUsecase } from "../update-dish.usecase";

const manager = buildAuthEntity({ role: StaffRole.MANAGER, branchId: "branch-a", branchIds: ["branch-a"] });
const dishOn = (branchId: string) =>
  ({
    id: "dish-1",
    restaurantId: manager.restaurantId,
    branchId,
    categoryId: "cat-1",
    name: "Momo",
    slug: "momo",
    price: 100,
    isAvailable: true,
    isArchived: false,
  }) as any;

describe("menu — every branch owns its own", () => {
  let create: CreateDishUsecase;
  let update: UpdateDishUsecase;
  let archive: ArchiveDishUsecase;
  let fetchAll: FetchAllDishesUsecase;
  let dishes: jest.Mocked<DishRepository>;
  let categories: jest.Mocked<MenuCategoryRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateDishUsecase,
        UpdateDishUsecase,
        ArchiveDishUsecase,
        FetchAllDishesUsecase,
        {
          provide: DishRepository,
          useValue: { findById: jest.fn(), findBySlug: jest.fn(), create: jest.fn(), update: jest.fn(), fetchAll: jest.fn() },
        },
        { provide: MenuCategoryRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: DishStatsService, useValue: { attach: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    create = module.get(CreateDishUsecase);
    update = module.get(UpdateDishUsecase);
    archive = module.get(ArchiveDishUsecase);
    fetchAll = module.get(FetchAllDishesUsecase);
    dishes = module.get(DishRepository);
    categories = module.get(MenuCategoryRepository);
  });

  it("creates a dish on the active branch's menu and checks its slug against that menu only", async () => {
    categories.findById.mockResolvedValue({ id: "cat-1", restaurantId: manager.restaurantId, branchId: "branch-a" } as any);
    dishes.findBySlug.mockResolvedValue(null);
    dishes.create.mockResolvedValue(dishOn("branch-a"));

    await create.execute({ categoryId: "cat-1", name: "Momo", price: 100 } as any, manager);

    expect(dishes.findBySlug).toHaveBeenCalledWith("branch-a", "momo");
    expect(dishes.create).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: manager.restaurantId, branchId: "branch-a" }),
      expect.anything()
    );
  });

  it("will not put a dish in a section that belongs to another branch's menu", async () => {
    categories.findById.mockResolvedValue({ id: "cat-1", restaurantId: manager.restaurantId, branchId: "branch-b" } as any);
    await expect(create.execute({ categoryId: "cat-1", name: "Momo", price: 100 } as any, manager)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(dishes.create).not.toHaveBeenCalled();
  });

  it("lists only the active branch's dishes", async () => {
    dishes.fetchAll.mockResolvedValue({ rows: [], count: 0 });
    await fetchAll.execute({} as any, manager);
    expect(dishes.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: manager.restaurantId, branchId: "branch-a" }),
      expect.anything()
    );
  });

  it("404s editing or archiving a dish on another branch's menu", async () => {
    dishes.findById.mockResolvedValue(dishOn("branch-b"));
    await expect(update.execute("dish-1", { name: "Renamed" } as any, manager)).rejects.toBeInstanceOf(NotFoundException);
    await expect(archive.execute("dish-1", manager)).rejects.toBeInstanceOf(NotFoundException);
    expect(dishes.update).not.toHaveBeenCalled();
  });
});
