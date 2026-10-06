import { ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../domain/repositories/ledger.repository";
import { ReopenLedgerUsecase } from "../reopen-ledger.usecase";

const authUser = buildAuthEntity();
const last = { id: "close-2", closedAt: new Date("2026-10-06T15:00:00Z"), closingCounted: 100, bankCounted: 200, closedByName: "Aarati" };

function build(closes: number) {
  const repo = {
    $transaction: jest.fn(fn => fn({})),
    findLastClose: jest.fn().mockResolvedValue(last),
    countCloses: jest.fn().mockResolvedValue(closes),
    deleteClose: jest.fn(),
  };
  const audit = { record: jest.fn() };
  return { repo, audit, usecase: new ReopenLedgerUsecase(repo as unknown as LedgerRepository, audit as unknown as AuditLogService) };
}

describe("ReopenLedgerUsecase", () => {
  it("deletes the latest close and logs it", async () => {
    const { repo, audit, usecase } = build(2);

    await usecase.execute(authUser);

    expect(repo.deleteClose).toHaveBeenCalledWith("close-2", expect.anything());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ledger_reopened" }), authUser, expect.anything());
  });

  it("never removes the opening setup", async () => {
    const { repo, usecase } = build(1);

    await expect(usecase.execute(authUser)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.deleteClose).not.toHaveBeenCalled();
  });
});
