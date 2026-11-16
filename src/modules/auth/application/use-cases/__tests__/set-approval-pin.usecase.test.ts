import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { hashPin, verifyPin } from "../../../../users/domain/utils/pin.util";
import { ChangeOwnPinUsecase } from "../change-own-pin.usecase";
import { SetApprovalPinUsecase } from "../set-approval-pin.usecase";

const manager = buildAuthEntity({ role: StaffRole.MANAGER });

async function setup(over: { approvalPinHash?: string | null } = {}) {
  const update = jest.fn();
  const audit = jest.fn();
  const user = { id: manager.sub, isActive: true, pinHash: await hashPin("4821"), approvalPinHash: over.approvalPinHash ?? null };
  const repo = { findByEmail: jest.fn().mockResolvedValue(user), update, $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})) };
  return { update, audit, usecase: new SetApprovalPinUsecase(repo as never, { record: audit } as never), repo };
}

describe("SetApprovalPinUsecase", () => {
  it("should store a hash of the approval PIN when the sign-in PIN is right, and say so in the audit log", async () => {
    const { usecase, update, audit } = await setup();
    await usecase.execute({ currentPin: "4821", approvalPin: "7351" }, manager);
    const [, data] = update.mock.calls[0];
    expect(await verifyPin("7351", data.approvalPinHash)).toBe(true);
    expect(data.pinHash).toBeUndefined();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.approval_pin_changed }), manager, expect.anything());
  });

  it("should refuse a wrong sign-in PIN without writing", async () => {
    const { usecase, update } = await setup();
    await expect(usecase.execute({ currentPin: "0000", approvalPin: "7351" }, manager)).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });

  it("should refuse an approval PIN that is the sign-in PIN", async () => {
    const { usecase, update } = await setup();
    await expect(usecase.execute({ currentPin: "4821", approvalPin: "4821" }, manager)).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("should refuse a role that never approves anything", async () => {
    const { usecase, update } = await setup();
    await expect(usecase.execute({ currentPin: "4821", approvalPin: "7351" }, buildAuthEntity({ role: StaffRole.STAFF }))).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ChangeOwnPinUsecase with an approval PIN", () => {
  it("should not let the sign-in PIN become the approval PIN", async () => {
    const user = { id: manager.sub, isActive: true, pinHash: await hashPin("4821"), approvalPinHash: await hashPin("7351") };
    const update = jest.fn();
    const usecase = new ChangeOwnPinUsecase({ findByEmail: jest.fn().mockResolvedValue(user), update } as never);
    await expect(usecase.execute({ currentPin: "4821", newPin: "7351" }, manager)).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    await expect(usecase.execute({ currentPin: "4821", newPin: "5555" }, manager)).resolves.toBeUndefined();
  });
});
