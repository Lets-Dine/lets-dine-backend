import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StockMovementReason } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { InventoryService } from "../../inventory.service";
import { SubmitStockTakeUsecase } from "../submit-stock-take.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const ing = (id: string, name: string, quantity: number) => ({ id, name, unit: "g", quantity }) as any;
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

describe("SubmitStockTakeUsecase", () => {
  let usecase: SubmitStockTakeUsecase;
  let repo: jest.Mocked<InventoryRepository>;
  let service: jest.Mocked<InventoryService>;
  let audit: jest.Mocked<AuditLogService>;
  const stock: Record<string, any> = {};

  beforeEach(async () => {
    stock[ID1] = ing(ID1, "Chicken", 1000);
    stock[ID2] = ing(ID2, "Rice", 500);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitStockTakeUsecase,
        {
          provide: InventoryRepository,
          useValue: {
            findIngredientsByIds: jest.fn(async (ids: string[]) => ids.map(id => stock[id]).filter(Boolean)),
            findIngredient: jest.fn(async (id: string) => stock[id] ?? null),
            findUnitCosts: jest.fn().mockResolvedValue(new Map([[ID1, { unit: 0.5, previous: null }]])),
            applyMovement: jest.fn(),
            $transaction: jest.fn(async (fn: any) => fn(tx)),
          },
        },
        { provide: InventoryService, useValue: { drawFromLots: jest.fn(), syncAvailability: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(SubmitStockTakeUsecase);
    repo = module.get(InventoryRepository);
    service = module.get(InventoryService);
    audit = module.get(AuditLogService);
  });

  it("corrects each difference, values it, and drains lots only for what went missing", async () => {
    const results = await usecase.execute(
      {
        counts: [
          { ingredientId: ID1, quantity: 800 },
          { ingredientId: ID2, quantity: 520 },
        ],
      },
      authUser
    );

    expect(results).toEqual([
      { ingredientId: ID1, name: "Chicken", unit: "g", expected: 1000, counted: 800, difference: -200, value: -100 },
      { ingredientId: ID2, name: "Rice", unit: "g", expected: 500, counted: 520, difference: 20, value: null },
    ]);
    expect(repo.applyMovement).toHaveBeenCalledWith(
      ID1,
      -200,
      { reason: StockMovementReason.ADJUSTMENT, note: "Stock take", createdBy: authUser.sub },
      tx
    );
    expect(service.drawFromLots).toHaveBeenCalledTimes(1);
    expect(service.drawFromLots).toHaveBeenCalledWith(ID1, 200, undefined, tx);
    expect(service.syncAvailability).toHaveBeenCalledWith(authUser.branchId, [ID1, ID2], tx);
  });

  it("changes nothing when the count matches, but still records that it happened", async () => {
    await usecase.execute({ counts: [{ ingredientId: ID1, quantity: 1000 }] }, authUser);

    expect(repo.applyMovement).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      { action: AuditAction.stock_taken, subject: "Stock take", detail: "1 counted, all matched" },
      authUser,
      tx
    );
  });

  it("puts the differences in the audit entry", async () => {
    await usecase.execute({ counts: [{ ingredientId: ID1, quantity: 800 }] }, authUser);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ detail: "1 counted, 1 off: Chicken -200 g" }), authUser, tx);
  });

  it("refuses an ingredient that isn't in this branch", async () => {
    await expect(
      usecase.execute({ counts: [{ ingredientId: "33333333-3333-4333-8333-333333333333", quantity: 1 }] }, authUser)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.applyMovement).not.toHaveBeenCalled();
  });
});
