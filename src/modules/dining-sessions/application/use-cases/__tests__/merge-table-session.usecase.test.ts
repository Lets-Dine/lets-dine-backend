import { BadRequestException, ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { MergeTableSessionUsecase } from "../merge-table-session.usecase";

const auth = buildAuthEntity();
const tx = {} as any;
const table = (id: string) => ({ id, name: `Table ${id}`, branchId: auth.branchId, restaurantId: auth.restaurantId, isActive: true });

function build({ target = null as any, paid = false } = {}) {
  const tables = {
    $transaction: jest.fn(fn => fn(tx)),
    findById: jest.fn(async (id: string) => table(id)),
    lockById: jest.fn(),
    update: jest.fn(async (id: string) => table(id)),
  };
  const sessions = {
    findOpenByTableId: jest.fn(async (id: string) => (id === "a" ? { id: "s-a" } : target)),
    hasPayments: jest.fn().mockResolvedValue(paid),
    update: jest.fn(async () => ({ id: "s-a" })),
  };
  const orders = { moveToSession: jest.fn(), findOpenBySessionId: jest.fn().mockResolvedValue([]) };
  const events = { emit: jest.fn() };
  const usecase = new MergeTableSessionUsecase(tables as any, sessions as any, orders as any, { record: jest.fn() } as any, events as any);
  return { usecase, tables, sessions, orders, events };
}

describe("MergeTableSessionUsecase", () => {
  it("refuses merging a table into itself", async () => {
    await expect(build().usecase.execute("a", "a", auth)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("moves the visit to an empty table, keeping its session", async () => {
    const r = build();
    await r.usecase.execute("a", "b", auth);

    expect(r.sessions.update).toHaveBeenCalledWith("s-a", { tableId: "b" }, tx);
    expect(r.orders.moveToSession).toHaveBeenCalledWith("s-a", { sessionId: "s-a", tableId: "b" }, { tx });
    expect(r.tables.update).toHaveBeenCalledWith("b", { currentSessionId: "s-a" }, expect.anything());
  });

  it("merges into an occupied table: orders join its session and the source visit ends", async () => {
    const r = build({ target: { id: "s-b" } });
    await r.usecase.execute("a", "b", auth);

    expect(r.orders.moveToSession).toHaveBeenCalledWith("s-a", { sessionId: "s-b", tableId: "b" }, { tx });
    expect(r.sessions.update).toHaveBeenCalledWith("s-a", expect.objectContaining({ endedAt: expect.any(Date) }), tx);
    expect(r.tables.update).toHaveBeenCalledWith("a", { currentSessionId: null }, expect.anything());
  });

  it("refuses once either visit has been paid, even in part", async () => {
    const r = build({ target: { id: "s-b" }, paid: true });
    await expect(r.usecase.execute("a", "b", auth)).rejects.toBeInstanceOf(ConflictException);
    expect(r.orders.moveToSession).not.toHaveBeenCalled();
  });
});
