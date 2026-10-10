import { Test, TestingModule } from "@nestjs/testing";
import { StockMovementReason } from "@prisma/client";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { TransferStockUsecase } from "../transfer-stock.usecase";

const BRANCH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authUser = buildAuthEntity({ branchIds: "all" } as any);
const source = (over = {}) =>
  ({
    id: "src",
    restaurantId: authUser.restaurantId,
    branchId: authUser.branchId,
    name: "Chicken",
    unit: "g",
    quantity: 1000,
    isArchived: false,
    ...over,
  }) as any;
const dest = (over = {}) => ({ id: "dst", name: "Chicken", unit: "g", isArchived: false, ...over }) as any;
const tx = {} as any;

describe("TransferStockUsecase", () => {
  let usecase: TransferStockUsecase;
  let repo: jest.Mocked<InventoryRepository>;
  let audit: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferStockUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            findBranch: jest
              .fn()
              .mockResolvedValue({ id: BRANCH_B, restaurantId: authUser.restaurantId, name: "Lakeside", isActive: true }),
            $transaction: jest.fn(async (fn: any) => fn(tx)),
            findIngredient: jest.fn().mockResolvedValue(source()),
            findIngredientByName: jest.fn().mockResolvedValue(dest()),
            createIngredient: jest.fn().mockResolvedValue(dest({ id: "new" })),
            updateIngredient: jest.fn().mockResolvedValue(dest()),
            findOpenLotDetails: jest.fn().mockResolvedValue([
              { id: "old", remaining: 300, supplier: "Ram", cost: 3000, quantity: 600, receivedAt: new Date("2026-10-01") },
              { id: "new", remaining: 700, supplier: "Sita", cost: 7000, quantity: 700, receivedAt: new Date("2026-10-05") },
            ]),
            applyLotUse: jest.fn(),
            createLot: jest.fn(),
            applyMovement: jest.fn().mockResolvedValue(source({ quantity: 600 })),
          },
        },
        { provide: InventoryService, useValue: { syncAvailability: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(TransferStockUsecase);
    repo = module.get(InventoryRepository);
    audit = module.get(AuditLogService);
  });

  it("moves stock out here and in there, carrying the oldest lots with their history", async () => {
    await usecase.execute("src", { toBranchId: BRANCH_B, quantity: 400 }, authUser);

    expect(repo.applyMovement).toHaveBeenCalledWith("src", -400, expect.objectContaining({ reason: StockMovementReason.TRANSFER_OUT }), tx);
    expect(repo.applyMovement).toHaveBeenCalledWith("dst", 400, expect.objectContaining({ reason: StockMovementReason.TRANSFER_IN }), tx);
    expect(repo.applyLotUse).toHaveBeenCalledWith(
      [
        { lotId: "old", quantity: 300 },
        { lotId: "new", quantity: 100 },
      ],
      undefined,
      tx
    );
    // 300 of the 600 g lot that cost 3000 -> 1500; 100 of the 700 g lot that cost 7000 -> 1000.
    expect(repo.createLot).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientId: "dst", supplier: "Ram", cost: 1500, quantity: 300, receivedAt: new Date("2026-10-01") }),
      tx
    );
    expect(repo.createLot).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientId: "dst", supplier: "Sita", cost: 1000, quantity: 100 }),
      tx
    );
  });

  it("creates the ingredient at the other branch when it is new there", async () => {
    repo.findIngredientByName.mockResolvedValue(null);
    await usecase.execute("src", { toBranchId: BRANCH_B, quantity: 100 }, authUser);
    expect(repo.createIngredient).toHaveBeenCalledWith(expect.objectContaining({ branchId: BRANCH_B, name: "Chicken", unit: "g" }), { tx });
  });

  it("logs the move in both branches", async () => {
    await usecase.execute("src", { toBranchId: BRANCH_B, quantity: 100 }, authUser);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ branchId: BRANCH_B }), tx);
  });

  it("refuses to send more than is in stock", async () => {
    await expect(usecase.execute("src", { toBranchId: BRANCH_B, quantity: 5000 }, authUser)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.applyMovement).not.toHaveBeenCalled();
  });

  it("refuses sending to the same branch", async () => {
    await expect(usecase.execute("src", { toBranchId: authUser.branchId, quantity: 1 }, authUser)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("treats another restaurant's branch as missing", async () => {
    repo.findBranch.mockResolvedValue({ id: BRANCH_B, restaurantId: "someone-else", name: "X", isActive: true });
    await expect(usecase.execute("src", { toBranchId: BRANCH_B, quantity: 1 }, authUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses a branch the staff member can't reach", async () => {
    await expect(
      usecase.execute("src", { toBranchId: BRANCH_B, quantity: 1 }, { ...authUser, branchIds: [authUser.branchId] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses when the other branch counts it in another unit", async () => {
    repo.findIngredientByName.mockResolvedValue(dest({ unit: "pcs" }));
    await expect(usecase.execute("src", { toBranchId: BRANCH_B, quantity: 1 }, authUser)).rejects.toBeInstanceOf(ConflictException);
  });
});
