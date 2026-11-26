import { StaffRole } from "@prisma/client";
import { AuthEntity } from "../../../../common/interfaces";
import { hashPin, verifyPin } from "../../../users/domain/utils/pin.util";
import { DeleteOwnAccountUsecase } from "../use-cases/delete-own-account.usecase";

const auth = { sub: "u1", email: "a@b.co", memberId: "m1" } as AuthEntity;

async function setup(options: { role?: StaffRole; ownerCount?: number; pin?: string } = {}) {
  const pinHash = await hashPin(options.pin ?? "1234");
  const userUpdate = jest.fn().mockResolvedValue(undefined);
  const memberUpdate = jest.fn().mockResolvedValue(undefined);
  const removeAllForMembers = jest.fn().mockResolvedValue(undefined);
  const tx = {};
  const userRepo = {
    findByEmail: jest.fn().mockResolvedValue({ id: "u1", isActive: true, pinHash }),
    update: userUpdate,
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const memberRepo = {
    findActiveByUserId: jest
      .fn()
      .mockResolvedValue([{ id: "m1", userId: "u1", restaurantId: "r1", role: options.role ?? StaffRole.STAFF }]),
    countActiveByRole: jest.fn().mockResolvedValue(options.ownerCount ?? 2),
    update: memberUpdate,
  };
  const notifications = { removeAllForMembers };
  const usecase = new DeleteOwnAccountUsecase(userRepo as never, memberRepo as never, notifications as never);
  return { usecase, userUpdate, memberUpdate, removeAllForMembers };
}

describe("DeleteOwnAccountUsecase", () => {
  it("deactivates memberships and anonymises the user when the PIN matches", async () => {
    const { usecase, userUpdate, memberUpdate, removeAllForMembers } = await setup();

    await usecase.execute({ pin: "1234" }, auth);

    expect(removeAllForMembers).toHaveBeenCalledWith(["m1"]);
    expect(memberUpdate).toHaveBeenCalledWith("m1", { isActive: false }, expect.anything());
    const [id, data] = userUpdate.mock.calls[0];
    expect(id).toBe("u1");
    expect(data).toMatchObject({
      name: "Deleted user",
      email: "deleted-u1@deleted.invalid",
      emailKey: null,
      phone: null,
      avatarUrl: null,
      approvalPinHash: null,
      isActive: false,
    });
    // The old PIN must no longer be usable, even if the account were reactivated by mistake.
    expect(await verifyPin("1234", data.pinHash)).toBe(false);
  });

  it("rejects a wrong PIN without changing anything", async () => {
    const { usecase, userUpdate, memberUpdate, removeAllForMembers } = await setup();

    await expect(usecase.execute({ pin: "0000" }, auth)).rejects.toThrow();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(memberUpdate).not.toHaveBeenCalled();
    expect(removeAllForMembers).not.toHaveBeenCalled();
  });

  it("refuses when the caller is the only owner of a restaurant", async () => {
    const { usecase, userUpdate, memberUpdate } = await setup({ role: StaffRole.OWNER, ownerCount: 1 });

    await expect(usecase.execute({ pin: "1234" }, auth)).rejects.toThrow();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(memberUpdate).not.toHaveBeenCalled();
  });

  it("allows an owner to delete when another owner exists", async () => {
    const { usecase, userUpdate } = await setup({ role: StaffRole.OWNER, ownerCount: 2 });

    await usecase.execute({ pin: "1234" }, auth);
    expect(userUpdate).toHaveBeenCalled();
  });
});
