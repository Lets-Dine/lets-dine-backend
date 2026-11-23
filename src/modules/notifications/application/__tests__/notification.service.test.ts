import { ForbiddenException } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { NotificationService } from "../notification.service";

const target = { restaurantId: "rest-1", branchId: "branch-1" };
const message = { title: "New order", body: "Table 4" };

function build(devices: { token: string; role: StaffRole }[], options: { enabled?: boolean; suspended?: boolean; dead?: string[] } = {}) {
  const prisma = {
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(devices.map(d => ({ token: d.token, member: { role: d.role } }))),
      deleteMany: jest.fn(),
    },
  };
  const push = { enabled: options.enabled ?? true, send: jest.fn().mockResolvedValue(options.dead ?? []) };
  const policy = {
    assertCanAccess: jest.fn(options.suspended ? () => Promise.reject(new ForbiddenException("suspended")) : () => Promise.resolve()),
  };
  return { service: new NotificationService(prisma as never, push as never, policy as never), prisma, push, policy };
}

describe("NotificationService.notifyBranch", () => {
  it("asks only for this branch's devices of active members", async () => {
    const { service, prisma } = build([{ token: "t1", role: StaffRole.STAFF }]);

    await service.notifyBranch(target, "orders:view", message);

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...target,
          member: {
            isActive: true,
            user: { isActive: true },
            // Still assigned to the branch today (or an owner, who reaches them all), not just when the phone registered.
            OR: [{ role: StaffRole.OWNER }, { branches: { some: { branchId: "branch-1" } } }],
          },
        },
      })
    );
  });

  it("drops devices whose member's role may not see the thing", async () => {
    const { service, push } = build([
      { token: "staff", role: StaffRole.STAFF },
      { token: "manager", role: StaffRole.MANAGER },
    ]);

    await service.notifyBranch(target, "payments:discount", message);

    expect(push.send).toHaveBeenCalledWith(["manager"], message);
  });

  it("sends nothing to a suspended restaurant", async () => {
    const { service, push } = build([{ token: "t1", role: StaffRole.OWNER }], { suspended: true });

    await service.notifyBranch(target, "orders:view", message);

    expect(push.send).not.toHaveBeenCalled();
  });

  it("does not even look up devices while push is off", async () => {
    const { service, prisma } = build([{ token: "t1", role: StaffRole.OWNER }], { enabled: false });

    await service.notifyBranch(target, "orders:view", message);

    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
  });

  it("forgets the tokens Firebase says are dead", async () => {
    const { service, prisma } = build([{ token: "gone", role: StaffRole.OWNER }], { dead: ["gone"] });

    await service.notifyBranch(target, "orders:view", message);

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ["gone"] } } });
  });

  it("stops waiting for a stuck Firebase call, so an order is never held up for long", async () => {
    jest.useFakeTimers();
    try {
      const { service, push } = build([{ token: "t1", role: StaffRole.OWNER }]);
      push.send.mockReturnValue(new Promise(() => undefined));

      const done = service.notifyBranch(target, "orders:view", message);
      await jest.advanceTimersByTimeAsync(4000);

      await expect(done).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it("never throws into the request that caused it", async () => {
    const { service, push } = build([{ token: "t1", role: StaffRole.OWNER }]);
    push.send.mockRejectedValue(new Error("fcm down"));

    await expect(service.notifyBranch(target, "orders:view", message)).resolves.toBeUndefined();
  });
});

describe("NotificationService devices", () => {
  it("hands a phone to whoever registers it last, in the branch they are working in", async () => {
    const upsert = jest.fn();
    const service = new NotificationService({ deviceToken: { upsert } } as never, {} as never, {} as never);

    await service.register({ memberId: "m2", restaurantId: "rest-1", branchId: "branch-2" }, "tok", "android");

    expect(upsert).toHaveBeenCalledWith({
      where: { token: "tok" },
      create: { token: "tok", memberId: "m2", restaurantId: "rest-1", branchId: "branch-2", platform: "android" },
      update: { memberId: "m2", restaurantId: "rest-1", branchId: "branch-2", platform: "android" },
    });
  });

  it("lets a member unregister only their own phone", async () => {
    const deleteMany = jest.fn();
    const service = new NotificationService({ deviceToken: { deleteMany } } as never, {} as never, {} as never);

    await service.unregister({ memberId: "m1" }, "tok");

    expect(deleteMany).toHaveBeenCalledWith({ where: { token: "tok", memberId: "m1" } });
  });
});
