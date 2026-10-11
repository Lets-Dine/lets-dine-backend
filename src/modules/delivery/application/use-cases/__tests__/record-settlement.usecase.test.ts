import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../../ledger/domain/repositories/ledger.repository";
import { DELIVERY_ERROR_MESSAGES } from "../../../domain/constants";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { RecordSettlementUsecase } from "../record-settlement.usecase";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const RIDER_ID = "66666666-6666-4666-8666-666666666666";
const rider = { id: RIDER_ID, ...scope, name: "Ramesh", partnerId: null };
const dto = {
  accountKind: "RIDER" as const,
  accountId: RIDER_ID,
  direction: "PAYOUT" as const,
  amount: 6000,
  offset: 0,
  method: "CASH" as const,
  note: "",
};
// Delivered runs earned 12,000 in fees; cash already received, 6,000 of fees already paid.
const totals = { cashCollected: 100000, feesEarned: 12000, collected: 100000, paidOut: 6000, offsets: 0 };

function build(over: Record<string, unknown> = {}) {
  const repo = {
    $transaction: jest.fn(fn => fn({})),
    findRider: jest.fn().mockResolvedValue(rider),
    findPartner: jest.fn(),
    sumAccount: jest.fn().mockResolvedValue(totals),
    createSettlement: jest.fn().mockImplementation(async data => ({ id: "st-1", ...data })),
    ...over,
  };
  const ledger = { createExpense: jest.fn() };
  const audit = { record: jest.fn() };
  return {
    repo,
    ledger,
    audit,
    usecase: new RecordSettlementUsecase(
      repo as unknown as DeliveryRepository,
      ledger as unknown as LedgerRepository,
      audit as unknown as AuditLogService
    ),
  };
}

describe("RecordSettlementUsecase", () => {
  describe("execute", () => {
    it("should pay fees owed, post the expense to the cash book tied to the settlement, and audit it", async () => {
      // Arrange
      const { repo, ledger, audit, usecase } = build();

      // Act
      await usecase.execute({ ...dto, note: "week 1" }, authUser);

      // Assert
      expect(repo.createSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ ...scope, accountId: RIDER_ID, direction: "PAYOUT", amount: 6000, createdByName: authUser.name }),
        expect.anything()
      );
      expect(ledger.createExpense).toHaveBeenCalledTimes(1);
      expect(ledger.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          ...scope,
          kind: "EXPENSE",
          amount: 6000,
          method: "CASH",
          category: "Delivery fees",
          deliverySettlementId: "st-1",
          note: "Ramesh · week 1",
        }),
        expect.anything()
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delivery_settled", subject: "Ramesh" }),
        authUser,
        expect.anything()
      );
    });

    it("should land a bank payment on the bank side", async () => {
      const { ledger, usecase } = build();

      await usecase.execute({ ...dto, method: "BANK" }, authUser);

      expect(ledger.createExpense).toHaveBeenCalledWith(expect.objectContaining({ method: "CARD" }), expect.anything());
    });

    it("should refuse to pay more than is owed, and post nothing", async () => {
      const { repo, ledger, usecase } = build();

      await expect(usecase.execute({ ...dto, amount: 6001 }, authUser)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createSettlement).not.toHaveBeenCalled();
      expect(ledger.createExpense).not.toHaveBeenCalled();
    });

    it("should refuse a collection: a courier's cash is received when each order is settled", async () => {
      const { repo, usecase } = build();

      await expect(usecase.execute({ ...dto, direction: "COLLECT" }, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.COLLECT_AT_ORDER.message,
      });
      expect(repo.createSettlement).not.toHaveBeenCalled();
    });

    it("should refuse netting a payment off cash", async () => {
      const { usecase } = build();

      await expect(usecase.execute({ ...dto, offset: 100 }, authUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should treat another branch's courier as missing", async () => {
      const { usecase } = build({ findRider: jest.fn().mockResolvedValue({ ...rider, branchId: "other-branch" }) });

      await expect(usecase.execute(dto, authUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should refuse an account for a rider who rides for a partner", async () => {
      const { repo, usecase } = build({
        findRider: jest.fn().mockResolvedValue({ ...rider, partnerId: "77777777-7777-4777-8777-777777777777" }),
      });

      await expect(usecase.execute(dto, authUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.createSettlement).not.toHaveBeenCalled();
    });
  });
});
