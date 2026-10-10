import { Test, TestingModule } from "@nestjs/testing";
import { StockMovementReason } from "@prisma/client";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryService } from "../inventory.service";

const tx = {} as any;

describe("InventoryService", () => {
  let service: InventoryService;
  let repo: jest.Mocked<InventoryRepository>;
  let entitlements: jest.Mocked<EntitlementService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: InventoryRepository,
          useValue: {
            findAutoConsumeSettings: jest.fn().mockResolvedValue({ restaurantId: "r1", dish: null, branch: null, restaurant: true }),
            findRecipeRules: jest.fn(),
            applyMovement: jest.fn(),
            findDishesUsingBase: jest.fn(),
            setDishAvailability: jest.fn(),
            findOpenLots: jest.fn().mockResolvedValue([]),
            applyLotUse: jest.fn(),
          },
        },
        { provide: EntitlementService, useValue: { hasFeature: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();
    service = module.get(InventoryService);
    entitlements = module.get(EntitlementService);
    repo = module.get(InventoryRepository);
  });

  describe("consumeForItem", () => {
    it("deducts the recipe × quantity, tagged to the order item", async () => {
      repo.findRecipeRules.mockResolvedValue([{ ingredientId: "chicken", variantId: null, addOnId: null, quantity: 200 }]);
      repo.findDishesUsingBase.mockResolvedValue([]);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 3 }, "b1", "u1", tx);

      expect(repo.applyMovement).toHaveBeenCalledWith(
        "chicken",
        -600,
        { reason: StockMovementReason.ORDER, orderItemId: "item-1", createdBy: "u1" },
        tx
      );
    });

    it.each([
      ["the dish is off", { restaurantId: "r1", dish: false, branch: true, restaurant: true }],
      ["the branch is off and the dish has no opinion", { restaurantId: "r1", dish: null, branch: false, restaurant: true }],
      ["the restaurant is off and nothing overrides it", { restaurantId: "r1", dish: null, branch: null, restaurant: false }],
    ])("leaves stock alone when %s", async (_name, settings) => {
      repo.findAutoConsumeSettings.mockResolvedValue(settings);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 3 }, "b1", "u1", tx);

      expect(repo.findRecipeRules).not.toHaveBeenCalled();
      expect(repo.applyMovement).not.toHaveBeenCalled();
    });

    it("leaves stock alone when the plan does not include automatic consumption, whatever is switched on", async () => {
      entitlements.hasFeature.mockResolvedValue(false);
      repo.findAutoConsumeSettings.mockResolvedValue({ restaurantId: "r1", dish: true, branch: true, restaurant: true });

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 1 }, "b1", "u1", tx);

      expect(entitlements.hasFeature).toHaveBeenCalledWith("r1", "autoStockConsumption");
      expect(repo.applyMovement).not.toHaveBeenCalled();
    });

    it("still consumes when the plan cannot be read, so a billing fault never stops the kitchen", async () => {
      entitlements.hasFeature.mockRejectedValue(new Error("db down"));
      repo.findRecipeRules.mockResolvedValue([{ ingredientId: "chicken", variantId: null, addOnId: null, quantity: 100 }]);
      repo.findDishesUsingBase.mockResolvedValue([]);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 1 }, "b1", "u1", tx);

      expect(repo.applyMovement).toHaveBeenCalled();
    });

    it("lets a dish switch consumption back on under an off branch", async () => {
      repo.findAutoConsumeSettings.mockResolvedValue({ restaurantId: "r1", dish: true, branch: false, restaurant: false });
      repo.findRecipeRules.mockResolvedValue([{ ingredientId: "chicken", variantId: null, addOnId: null, quantity: 100 }]);
      repo.findDishesUsingBase.mockResolvedValue([]);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 1 }, "b1", "u1", tx);

      expect(repo.applyMovement).toHaveBeenCalled();
    });

    it("records the order line against the oldest lots it drew from", async () => {
      repo.findRecipeRules.mockResolvedValue([{ ingredientId: "chicken", variantId: null, addOnId: null, quantity: 200 }]);
      repo.findDishesUsingBase.mockResolvedValue([]);
      repo.findOpenLots.mockResolvedValue([
        { id: "old", remaining: 300 },
        { id: "new", remaining: 900 },
      ]);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 2 }, "b1", "u1", tx);

      expect(repo.applyLotUse).toHaveBeenCalledWith(
        [
          { lotId: "old", quantity: 300 },
          { lotId: "new", quantity: 100 },
        ],
        "item-1",
        tx
      );
    });

    it("touches nothing for a dish with no recipe", async () => {
      repo.findRecipeRules.mockResolvedValue([]);

      await service.consumeForItem({ id: "item-1", dishId: "d1", variantId: null, addOnIds: [], quantity: 1 }, "b1", "u1", tx);

      expect(repo.applyMovement).not.toHaveBeenCalled();
      expect(repo.findDishesUsingBase).not.toHaveBeenCalled();
    });
  });

  describe("syncAvailability", () => {
    const dish = (over: object) => ({
      id: "d1",
      isAvailable: true,
      autoSoldOut: false,
      baseLines: [{ quantity: 200, ingredient: { quantity: 100 } }],
      ...over,
    });

    it("sells a dish out when its recipe can't be made", async () => {
      repo.findDishesUsingBase.mockResolvedValue([dish({})]);
      await service.syncAvailability("b1", ["chicken"], tx);
      expect(repo.setDishAvailability).toHaveBeenCalledWith("d1", { isAvailable: false, autoSoldOut: true }, tx);
    });

    it("brings back a dish stock switched off once restocked", async () => {
      repo.findDishesUsingBase.mockResolvedValue([
        dish({ isAvailable: false, autoSoldOut: true, baseLines: [{ quantity: 200, ingredient: { quantity: 900 } }] }),
      ]);
      await service.syncAvailability("b1", ["chicken"], tx);
      expect(repo.setDishAvailability).toHaveBeenCalledWith("d1", { isAvailable: true, autoSoldOut: false }, tx);
    });

    it("leaves a dish a person switched off alone, even when stock is back", async () => {
      repo.findDishesUsingBase.mockResolvedValue([
        dish({ isAvailable: false, autoSoldOut: false, baseLines: [{ quantity: 200, ingredient: { quantity: 900 } }] }),
      ]);
      await service.syncAvailability("b1", ["chicken"], tx);
      expect(repo.setDishAvailability).not.toHaveBeenCalled();
    });
  });
});
