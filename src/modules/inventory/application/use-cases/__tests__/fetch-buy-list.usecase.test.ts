import { Test, TestingModule } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { FetchBuyListUsecase } from "../fetch-buy-list.usecase";

const authUser = buildAuthEntity();
const ing = (over: object) => ({ id: "i1", name: "Chicken", unit: "g", quantity: 0, parLevel: 0, ...over }) as any;

describe("FetchBuyListUsecase", () => {
  let usecase: FetchBuyListUsecase;
  let repo: jest.Mocked<InventoryRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchBuyListUsecase,
        {
          provide: InventoryRepository,
          useValue: { findIngredients: jest.fn(), findUsage: jest.fn(), findLastPurchases: jest.fn(), findBranchTimezone: jest.fn() },
        },
      ],
    }).compile();
    usecase = module.get(FetchBuyListUsecase);
    repo = module.get(InventoryRepository);
    repo.findBranchTimezone.mockResolvedValue("Asia/Kathmandu");
    repo.findUsage.mockResolvedValue(new Map());
  });

  it("lists only what is short, restocking to the warning line when there is no history", async () => {
    repo.findIngredients.mockResolvedValue([
      ing({ id: "low", name: "Rice", quantity: 100, parLevel: 500 }),
      ing({ id: "fine", name: "Oil", quantity: 900, parLevel: 500 }),
    ]);
    repo.findLastPurchases.mockResolvedValue(new Map());

    const list = await usecase.execute({ days: 1 }, authUser);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Rice", toBuy: 400, supplier: null, estimatedCost: null });
  });

  it("prices it at the last purchase and names that supplier", async () => {
    repo.findIngredients.mockResolvedValue([ing({ quantity: 0, parLevel: 2000 })]);
    // Last lot: 10,000 g for Rs 1,500 (150,000 paisa) -> 15 paisa per gram.
    repo.findLastPurchases.mockResolvedValue(
      new Map([["i1", { ingredientId: "i1", supplier: "Ram Suppliers", cost: 150000, quantity: 10000 }]])
    );

    const [item] = await usecase.execute({ days: 1 }, authUser);

    expect(item).toMatchObject({ toBuy: 2000, supplier: "Ram Suppliers", estimatedCost: 30000 });
  });
});
