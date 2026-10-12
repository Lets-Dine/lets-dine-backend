import { Test, TestingModule } from "@nestjs/testing";
import { ExpenseKind, StockMovementReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { ReturnStockUsecase } from "../return-stock.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const lot = (over = {}) => ({ id: "l1", ingredientId: "i1", supplier: "Ram Traders", cost: 1000, quantity: 10, remaining: 8, onCredit: false, fromTransfer: false, ...over });
const input = (over = {}) => ({ lotId: "l1", quantity: 4, method: "CASH" as const, note: "", ...over });

describe("ReturnStockUsecase", () => {
  let usecase: ReturnStockUsecase;
  let repo: jest.Mocked<InventoryRepository>;

  const setup = async (found: unknown, { owed = 1000, refunded = 0, ingredient = {} }: { owed?: number; refunded?: number; ingredient?: object } = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnStockUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            $transaction: jest.fn(async (fn: any) => fn(tx)),
            findIngredient: jest.fn().mockResolvedValue({ id: "i1", name: "Chicken", quantity: 20, isArchived: false, restaurantId: authUser.restaurantId, branchId: authUser.branchId, ...ingredient }),
            findLot: jest.fn().mockResolvedValue(found),
            applyMovement: jest.fn().mockResolvedValue({ id: "i1" }),
            reduceLot: jest.fn().mockResolvedValue(true),
            findLotRefunded: jest.fn().mockResolvedValue(refunded),
            findSupplierOwed: jest.fn().mockResolvedValue(owed),
            createSupplierReturn: jest.fn(),
            createStockExpense: jest.fn(),
          },
        },
        { provide: InventoryService, useValue: { syncAvailability: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(ReturnStockUsecase);
    repo = module.get(InventoryRepository);
  };

  it("returns part of a paid delivery, and books the refund share as income", async () => {
    await setup(lot());
    await usecase.execute("i1", input({ quantity: 4 }), authUser);
    expect(repo.applyMovement).toHaveBeenCalledWith("i1", -4, expect.objectContaining({ reason: StockMovementReason.RETURN, cost: 400 }), tx);
    expect(repo.reduceLot).toHaveBeenCalledWith("l1", 4, tx);
    expect(repo.createStockExpense).toHaveBeenCalledWith(expect.objectContaining({ kind: ExpenseKind.INCOME, amount: 400 }), tx);
  });

  it("books nothing in the cash book for a credit delivery: the refund comes off what is owed", async () => {
    await setup(lot({ onCredit: true }), { owed: 1000 });
    await usecase.execute("i1", input(), authUser);
    expect(repo.createSupplierReturn).toHaveBeenCalledWith(expect.objectContaining({ amount: 400, owedOffset: 400 }), tx);
    expect(repo.createStockExpense).not.toHaveBeenCalled();
  });

  it("on a credit delivery already mostly paid, only what is still owed comes off; the rest is money back", async () => {
    await setup(lot({ onCredit: true }), { owed: 100 });
    await usecase.execute("i1", input(), authUser);
    expect(repo.createSupplierReturn).toHaveBeenCalledWith(expect.objectContaining({ amount: 400, owedOffset: 100 }), tx);
    expect(repo.createStockExpense).toHaveBeenCalledWith(expect.objectContaining({ kind: ExpenseKind.INCOME, amount: 300 }), tx);
  });

  it("never refunds more in total than the delivery cost, across partial returns", async () => {
    await setup(lot({ cost: 1001, quantity: 2, remaining: 2 }), { refunded: 501 });
    await expect(usecase.execute("i1", input({ quantity: 1, refund: 501 }), authUser)).rejects.toThrow(BadRequestException);
    await usecase.execute("i1", input({ quantity: 1 }), authUser);
    expect(repo.createSupplierReturn).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 }), tx);
  });

  it("refuses to return stock that is no longer on the shelf, even if the delivery shows some left", async () => {
    await setup(lot({ remaining: 10 }), { ingredient: { quantity: 3 } });
    await expect(usecase.execute("i1", input({ quantity: 4 }), authUser)).rejects.toThrow(BadRequestException);
  });

  it("refuses when another return took the stock first", async () => {
    await setup(lot());
    repo.reduceLot.mockResolvedValue(false);
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(BadRequestException);
    expect(repo.createSupplierReturn).not.toHaveBeenCalled();
  });

  it("refuses an archived ingredient", async () => {
    await setup(lot(), { ingredient: { isArchived: true } });
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(NotFoundException);
  });

  it("accepts a smaller refund than the share, such as none while a replacement is awaited", async () => {
    await setup(lot());
    await usecase.execute("i1", input({ refund: 0 }), authUser);
    expect(repo.createStockExpense).not.toHaveBeenCalled();
  });

  it("refuses more than is left of that delivery", async () => {
    await setup(lot({ remaining: 3 }));
    await expect(usecase.execute("i1", input({ quantity: 4 }), authUser)).rejects.toThrow(BadRequestException);
    expect(repo.reduceLot).not.toHaveBeenCalled();
  });

  it("refuses a refund above the share of what was paid", async () => {
    await setup(lot());
    await expect(usecase.execute("i1", input({ refund: 401 }), authUser)).rejects.toThrow(BadRequestException);
  });

  it("refuses a delivery of another ingredient, from a transfer, or with no supplier", async () => {
    await setup(lot({ ingredientId: "other" }));
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(NotFoundException);
    await setup(lot({ fromTransfer: true }));
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(NotFoundException);
    await setup(lot({ supplier: null }));
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(NotFoundException);
  });
});
