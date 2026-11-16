import { AuditAction, StaffRole } from "@prisma/client";
import { ForbiddenException } from "../../../../common/exceptions";
import { buildAuthEntity } from "../../../../common/testing";
import { hashPin } from "../../../users/domain/utils/pin.util";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { ApprovalAttemptLimiter, PaymentApprovalService } from "../payment-approval.service";

const cashier = buildAuthEntity({ role: StaffRole.STAFF });
const manager = {
  id: "member-m",
  userId: "user-m",
  restaurantId: cashier.restaurantId,
  role: StaffRole.MANAGER as StaffRole,
  isActive: true,
  name: "Bimal Rai",
  email: "bimal@lets-dine.test",
  phone: null,
  avatarUrl: null,
  hasApprovalPin: true,
  branchIds: [cashier.branchId],
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function setup(over: { member?: Partial<typeof manager> | null; userActive?: boolean; approvalPin?: string | null } = {}) {
  const member = over.member === null ? null : { ...manager, ...over.member };
  // The sign-in PIN is 4821 and the approval PIN 7351: only the second approves.
  const pinHash = await hashPin("4821");
  const approvalPinHash = over.approvalPin === null ? null : await hashPin(over.approvalPin ?? "7351");
  const audit = jest.fn();
  const limiter = new ApprovalAttemptLimiter();
  const findByEmail = jest.fn().mockResolvedValue({ id: "user-m", isActive: over.userActive ?? true, pinHash, approvalPinHash });
  const service = new PaymentApprovalService(
    { findById: jest.fn().mockResolvedValue(member), fetchAll: jest.fn().mockResolvedValue({ rows: [manager, { ...manager, id: "owner", role: StaffRole.OWNER, branchIds: [] }, { ...manager, id: "staff", role: StaffRole.STAFF }, { ...manager, id: "elsewhere", branchIds: ["other-branch"] }, { ...manager, id: "left", isActive: false }, { ...manager, id: "no-pin", hasApprovalPin: false }], count: 6 }) } as never,
    { findByEmail } as never,
    { record: audit } as never,
    limiter
  );
  return { service, audit, limiter, userLookups: () => findByEmail.mock.calls.length };
}

describe("PaymentApprovalService", () => {
  it("should accept an eligible manager with the right PIN", async () => {
    const { service, audit } = await setup();
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).resolves.toMatchObject({ id: manager.id });
    expect(audit).not.toHaveBeenCalled();
  });

  it("should refuse the sign-in PIN: it is not the approval PIN, so seeing it typed at a till opens nothing", async () => {
    const { service } = await setup();
    await expect(service.verify({ memberId: manager.id, pin: "4821" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
  });

  it("should refuse a manager who has not set an approval PIN, whatever they type", async () => {
    const { service } = await setup({ approvalPin: null });
    for (const pin of ["4821", "7351", "0000"]) await expect(service.verify({ memberId: manager.id, pin }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
  });

  it("should refuse a wrong PIN with the same answer as any other refusal, and record the attempt", async () => {
    const { service, audit } = await setup();
    await expect(service.verify({ memberId: manager.id, pin: "0000" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.payment_override_denied, subject: "Bimal Rai" }), cashier);
  });

  it("should refuse somebody who cannot approve, whatever PIN they give", async () => {
    for (const member of [
      { role: StaffRole.STAFF },
      { isActive: false },
      { restaurantId: "another-restaurant" },
      { branchIds: ["a-branch-this-till-is-not-in"] },
    ]) {
      const { service } = await setup({ member });
      await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
    }
    const { service } = await setup({ member: null });
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
  });

  it("should refuse an approver whose account is switched off", async () => {
    const { service } = await setup({ userActive: false });
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID));
  });

  it("should let an owner approve at any branch", async () => {
    const { service } = await setup({ member: { role: StaffRole.OWNER, branchIds: [] } });
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).resolves.toBeDefined();
  });

  it("should lock a cashier out after five wrong PINs, even for the right one, until the window passes", async () => {
    const { service, limiter } = await setup();
    for (let i = 0; i < 5; i++) await expect(service.verify({ memberId: manager.id, pin: "0000" }, cashier)).rejects.toThrow(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID.message);
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, cashier)).rejects.toThrow(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_LOCKED));
    expect(limiter.isLocked(manager.id, cashier.sub, Date.now() + 16 * 60_000)).toBe(false);
  });

  it("should not let one cashier's wrong guesses lock the manager out for everyone else", async () => {
    const { service } = await setup();
    const other = buildAuthEntity({ role: StaffRole.STAFF, sub: "another-cashier" });
    for (let i = 0; i < 6; i++) await service.verify({ memberId: manager.id, pin: "0000" }, cashier).catch(() => undefined);
    await expect(service.verify({ memberId: manager.id, pin: "7351" }, other)).resolves.toMatchObject({ id: manager.id });
  });

  it("should count a burst of parallel guesses as they arrive, not after each has been checked", async () => {
    const { service, userLookups } = await setup();
    await Promise.all(Array.from({ length: 40 }, (_, i) => service.verify({ memberId: manager.id, pin: String(1000 + i) }, cashier).catch(() => undefined)));
    // Five get as far as testing a PIN; the rest are turned away before any slow work.
    expect(userLookups()).toBeLessThanOrEqual(5);
  });

  it("should hand an attempt back when the PIN is right", async () => {
    const { service, limiter } = await setup();
    for (let i = 0; i < 4; i++) await service.verify({ memberId: manager.id, pin: "0000" }, cashier).catch(() => undefined);
    await service.verify({ memberId: manager.id, pin: "7351" }, cashier);
    expect(limiter.isLocked(manager.id, cashier.sub)).toBe(false);
  });

  it("should list only active members who may discount, reach this branch and have set an approval PIN", async () => {
    const { service } = await setup();
    const listed = await service.listApprovers(cashier);
    expect(listed.map(m => m.id).sort()).toEqual(["member-m", "owner"]);
  });
});
