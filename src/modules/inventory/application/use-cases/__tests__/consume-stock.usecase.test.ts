import { Test, TestingModule } from "@nestjs/testing";
import { StockMovementReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { ConsumeStockUsecase } from "../consume-stock.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const DISH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const input = (over = {}) => ({ quantity: 300, note: "", ...over });

describe("ConsumeStockUsecase", () => {
  let usecase: ConsumeStockUsecase;
  let repo: jest.Mocked<InventoryRepository>;
  let service: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumeStockUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            $transaction: jest.fn(async (fn: any) => fn(tx)),
            findIngredient: jest
              .fn()
              .mockResolvedValue({ id: "i1", quantity: 1000, restaurantId: authUser.restaurantId, branchId: authUser.branchId }),
            findDishInBranch: jest.fn().mockResolvedValue({ id: DISH }),
            applyMovement: jest.fn().mockResolvedValue({ id: "i1", quantity: 700 }),
          },
        },
        { provide: InventoryService, useValue: { drawFromLots: jest.fn(), syncAvailability: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(ConsumeStockUsecase);
    repo = module.get(InventoryRepository);
    service = module.get(InventoryService);
  });

  it("takes the amount off, tags the dish and draws the oldest lots down", async () => {
    await usecase.execute("i1", input({ dishId: DISH }), authUser);

    expect(repo.applyMovement).toHaveBeenCalledWith(
      "i1",
      -300,
      expect.objectContaining({ reason: StockMovementReason.MANUAL_USE, dishId: DISH, createdBy: authUser.sub }),
      tx
    );
    expect(service.drawFromLots).toHaveBeenCalledWith("i1", 300, undefined, tx);
    expect(service.syncAvailability).toHaveBeenCalledWith(authUser.branchId, ["i1"], tx);
  });

  it("files a backdated use on the day it happened", async () => {
    await usecase.execute("i1", input({ usedAt: "2026-10-01T06:00:00.000Z" }), authUser);

    expect(repo.applyMovement).toHaveBeenCalledWith(
      "i1",
      -300,
      expect.objectContaining({ createdAt: new Date("2026-10-01T06:00:00.000Z") }),
      tx
    );
  });

  it("refuses to use more than is in stock", async () => {
    await expect(usecase.execute("i1", input({ quantity: 1500 }), authUser)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.applyMovement).not.toHaveBeenCalled();
  });

  it("refuses a dish that is not on this branch's menu", async () => {
    repo.findDishInBranch.mockResolvedValue(null);

    await expect(usecase.execute("i1", input({ dishId: DISH }), authUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.applyMovement).not.toHaveBeenCalled();
  });
});
