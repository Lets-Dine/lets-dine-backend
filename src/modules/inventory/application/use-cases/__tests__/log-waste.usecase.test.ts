import { Test, TestingModule } from "@nestjs/testing";
import { StockMovementReason, WasteReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { LogWasteUsecase } from "../log-waste.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const input = (over = {}) => ({ quantity: 300, reason: WasteReason.SPOILED, note: "", ...over });

describe("LogWasteUsecase", () => {
  let usecase: LogWasteUsecase;
  let repo: jest.Mocked<InventoryRepository>;
  let service: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogWasteUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            $transaction: jest.fn(async (fn: any) => fn(tx)),
            lockIngredient: jest.fn(),
            findIngredient: jest
              .fn()
              .mockResolvedValue({ id: "i1", quantity: 1000, restaurantId: authUser.restaurantId, branchId: authUser.branchId }),
            findOpenLotDetails: jest.fn().mockResolvedValue([
              { id: "old", remaining: 200, cost: 1000, quantity: 500 },
              { id: "new", remaining: 1000, cost: 3000, quantity: 1000 },
            ]),
            applyMovement: jest.fn().mockResolvedValue({ id: "i1", quantity: 700 }),
            applyLotUse: jest.fn(),
          },
        },
        { provide: InventoryService, useValue: { syncAvailability: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(LogWasteUsecase);
    repo = module.get(InventoryRepository);
    service = module.get(InventoryService);
  });

  it("records a WASTE movement with the reason and the cost of the lots it drew from, oldest first", async () => {
    await usecase.execute("i1", input(), authUser);

    // 200 from the old lot (1000/500 each) = 400, 100 from the new lot (3000/1000 each) = 300.
    expect(repo.applyMovement).toHaveBeenCalledWith(
      "i1",
      -300,
      expect.objectContaining({ reason: StockMovementReason.WASTE, wasteReason: WasteReason.SPOILED, wasteCost: 700 }),
      tx
    );
    expect(repo.applyLotUse).toHaveBeenCalledWith(
      [
        { lotId: "old", quantity: 200 },
        { lotId: "new", quantity: 100 },
      ],
      undefined,
      tx
    );
    expect(service.syncAvailability).toHaveBeenCalled();
  });

  it("leaves the cost unknown when the lots cannot cover it, rather than calling it free", async () => {
    repo.findOpenLotDetails.mockResolvedValue([{ id: "old", remaining: 100, cost: 1000, quantity: 500 }] as any);
    await usecase.execute("i1", input(), authUser);
    expect(repo.applyMovement).toHaveBeenCalledWith("i1", -300, expect.objectContaining({ wasteCost: null }), tx);
  });

  it("locks the ingredient before reading its stock and lots", async () => {
    await usecase.execute("i1", input(), authUser);
    expect(repo.lockIngredient.mock.invocationCallOrder[0]).toBeLessThan(repo.findIngredient.mock.invocationCallOrder[0]);
    expect(repo.lockIngredient.mock.invocationCallOrder[0]).toBeLessThan(repo.findOpenLotDetails.mock.invocationCallOrder[0]);
  });

  it("refuses more than is in stock", async () => {
    await expect(usecase.execute("i1", input({ quantity: 5000 }), authUser)).rejects.toThrow(BadRequestException);
    expect(repo.applyMovement).not.toHaveBeenCalled();
  });

  it("does not find another branch's ingredient", async () => {
    repo.findIngredient.mockResolvedValue({ id: "i1", quantity: 1000, restaurantId: "other", branchId: "other" } as any);
    await expect(usecase.execute("i1", input(), authUser)).rejects.toThrow(NotFoundException);
  });
});
