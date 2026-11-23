import { KitchenStation, OrderStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { ReprintKitchenTicketsUsecase } from "../reprint-kitchen-tickets.usecase";

const authUser = buildAuthEntity();
const order = {
  id: "o1",
  branchId: authUser.branchId,
  restaurantId: authUser.restaurantId,
  tableId: "t1",
  floorId: null,
  status: OrderStatus.PREPARING,
};
const ticket = { id: "k1", station: KitchenStation.KITCHEN };
const printer = { id: "p1", fullKot: true, stations: [], tableAssignment: false, tableIds: [], floorIds: [] };

function setup(over: { order?: unknown; tickets?: unknown[]; printers?: unknown[] } = {}) {
  const createMany = jest.fn().mockResolvedValue(undefined);
  const emit = jest.fn();
  const usecase = new ReprintKitchenTicketsUsecase(
    { findById: jest.fn().mockResolvedValue("order" in over ? over.order : order) } as never,
    { findByOrder: jest.fn().mockResolvedValue(over.tickets ?? [ticket]) } as never,
    { findByBranch: jest.fn().mockResolvedValue(over.printers ?? [printer]) } as never,
    { createMany } as never,
    { emit } as never
  );
  return { usecase, createMany, emit };
}

describe("ReprintKitchenTicketsUsecase", () => {
  it("should queue a print job per routed printer for the order's ticket, and wake the printing PC", async () => {
    const { usecase, createMany, emit } = setup();
    await expect(usecase.execute("o1", authUser)).resolves.toEqual({ jobs: 1 });
    expect(createMany).toHaveBeenCalledWith([{ printerId: "p1", ticketIds: ["k1"], branchId: authUser.branchId, orderId: "o1" }]);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("should print only the latest ticket of a station, never the history behind it", async () => {
    const older = { id: "k-old", station: KitchenStation.KITCHEN };
    const newest = { id: "k-new", station: KitchenStation.KITCHEN };
    const bar = { id: "k-bar", station: KitchenStation.BAR };
    const { usecase, createMany } = setup({ tickets: [older, bar, newest] });
    await usecase.execute("o1", authUser);
    expect(createMany.mock.calls[0][0][0].ticketIds.sort()).toEqual(["k-bar", "k-new"]);
  });

  it("should not reprint an order the kitchen has finished or never started", async () => {
    for (const status of [OrderStatus.READY, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.PENDING]) {
      const { usecase, createMany } = setup({ order: { ...order, status } });
      await expect(usecase.execute("o1", authUser)).rejects.toThrow(BadRequestException);
      expect(createMany).not.toHaveBeenCalled();
    }
  });

  it("should not reveal an order from another branch", async () => {
    const { usecase, createMany } = setup({ order: { ...order, branchId: "other-branch" } });
    await expect(usecase.execute("o1", authUser)).rejects.toThrow(NotFoundException);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("should say so when nothing was sent to the kitchen yet, or no printer would take it", async () => {
    await expect(setup({ tickets: [] }).usecase.execute("o1", authUser)).rejects.toThrow(BadRequestException);
    await expect(setup({ printers: [] }).usecase.execute("o1", authUser)).rejects.toThrow(BadRequestException);
  });
});
