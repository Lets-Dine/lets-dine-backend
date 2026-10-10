import { Test, TestingModule } from "@nestjs/testing";
import { StockMovementReason } from "@prisma/client";
import { ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { CreateIngredientUsecase } from "../create-ingredient.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const input = (over = {}) => ({ name: "Chicken", unit: "g", quantity: 5000, parLevel: 0, cost: 0, ...over });

describe("CreateIngredientUsecase", () => {
  let usecase: CreateIngredientUsecase;
  let repo: jest.Mocked<InventoryRepository>;
  let service: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateIngredientUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            $transaction: jest.fn(async (fn: any) => fn(tx)),
            findIngredientByName: jest.fn().mockResolvedValue(null),
            createIngredient: jest.fn().mockResolvedValue({ id: "i1", quantity: 0 }),
            updateIngredient: jest.fn().mockResolvedValue({ id: "old", quantity: 800 }),
            closeOpenLots: jest.fn(),
            clearRecipeLines: jest.fn(),
            createLot: jest.fn(),
            applyMovement: jest.fn().mockResolvedValue({ id: "i1", quantity: 5000 }),
          },
        },
        { provide: InventoryService, useValue: { syncAvailability: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(CreateIngredientUsecase);
    repo = module.get(InventoryRepository);
    service = module.get(InventoryService);
  });

  it("puts what the opening stock cost on its lot, so dish margins work from day one", async () => {
    await usecase.execute(input({ cost: 240000 }), authUser);
    expect(repo.createLot).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: "i1", quantity: 5000, cost: 240000 }), tx);
  });

  it("leaves the cost off when none was given", async () => {
    await usecase.execute(input(), authUser);
    expect(repo.createLot).toHaveBeenCalledWith(expect.objectContaining({ cost: undefined }), tx);
  });

  it("makes no lot when there is no opening stock", async () => {
    await usecase.execute(input({ quantity: 0 }), authUser);
    expect(repo.createLot).not.toHaveBeenCalled();
  });

  it("refuses a name that is already in use", async () => {
    repo.findIngredientByName.mockResolvedValue({ id: "x", isArchived: false } as any);
    await expect(usecase.execute(input(), authUser)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createIngredient).not.toHaveBeenCalled();
  });

  describe("when a removed ingredient has the same name", () => {
    const removed = (over = {}) => ({ id: "old", name: "Chicken", unit: "g", quantity: 800, isArchived: true, ...over }) as any;

    it("brings it back instead of clashing, restarting the shelf at the entered amount", async () => {
      repo.findIngredientByName.mockResolvedValue(removed());
      repo.applyMovement.mockResolvedValue({ id: "old", quantity: 5000 } as any);
      await usecase.execute(input({ quantity: 5000, parLevel: 1000 }), authUser);

      expect(repo.createIngredient).not.toHaveBeenCalled();
      expect(repo.closeOpenLots).toHaveBeenCalledWith("old", tx);
      expect(repo.updateIngredient).toHaveBeenCalledWith("old", { isArchived: false, unit: "g", parLevel: 1000 }, { tx });
      // 800 g was left when it was removed; 5000 g is the new count, so +4200.
      expect(repo.applyMovement).toHaveBeenCalledWith(
        "old",
        4200,
        expect.objectContaining({ reason: StockMovementReason.ADJUSTMENT, note: "Added back" }),
        tx
      );
      expect(service.syncAvailability).toHaveBeenCalledWith(authUser.branchId, ["old"], tx);
    });

    it("keeps its recipes when the unit is the same, clears them when it changed", async () => {
      repo.findIngredientByName.mockResolvedValue(removed());
      await usecase.execute(input(), authUser);
      expect(repo.clearRecipeLines).not.toHaveBeenCalled();

      repo.findIngredientByName.mockResolvedValue(removed({ unit: "pcs" }));
      await usecase.execute(input(), authUser);
      expect(repo.clearRecipeLines).toHaveBeenCalledWith("old", tx);
    });
  });
});
