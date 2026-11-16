import { AuthEntity } from "../../../../common/interfaces";
import { hashPin, verifyPin } from "../../../users/domain/utils/pin.util";
import { ChangeOwnPinUsecase } from "../use-cases/change-own-pin.usecase";

const auth = { sub: "u1", email: "a@b.co" } as AuthEntity;

function setup(pinHash: string) {
  const update = jest.fn();
  const repo = { findByEmail: jest.fn().mockResolvedValue({ id: "u1", isActive: true, pinHash }), update };
  return { update, usecase: new ChangeOwnPinUsecase(repo as never) };
}

describe("ChangeOwnPinUsecase", () => {
  it("stores a hash of the new PIN when the current one matches", async () => {
    const { usecase, update } = setup(await hashPin("1234"));
    await usecase.execute({ currentPin: "1234", newPin: "5678" }, auth);
    const [, data] = update.mock.calls[0];
    expect(await verifyPin("5678", data.pinHash)).toBe(true);
  });

  it("rejects a wrong current PIN without writing", async () => {
    const { usecase, update } = setup(await hashPin("1234"));
    await expect(usecase.execute({ currentPin: "0000", newPin: "5678" }, auth)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
