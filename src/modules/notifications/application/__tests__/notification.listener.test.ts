import { NotificationListener } from "../notification.listener";

const order = {
  id: "o1",
  reference: "#1001",
  restaurantId: "rest-1",
  branchId: "branch-1",
  orderType: "DINE_IN",
  tableName: "Table 4",
  floorName: null,
} as never;

describe("NotificationListener", () => {
  let notifyBranch: jest.Mock;
  let listener: NotificationListener;

  beforeEach(() => {
    notifyBranch = jest.fn();
    listener = new NotificationListener({ notifyBranch } as never);
  });

  it("tells the floor about a diner's new order, naming the table", () => {
    listener.onOrderPlaced(order);

    expect(notifyBranch).toHaveBeenCalledWith(order, "orders:view", expect.objectContaining({ title: "New order #1001", body: "Table 4" }));
  });

  it("sends one 'ready to serve' for the lines of a ticket that arrive together", () => {
    listener.onItemReady(order);
    listener.onItemReady(order);
    listener.onItemReady({ ...(order as object), id: "o2" } as never);

    expect(notifyBranch).toHaveBeenCalledTimes(2);
  });

  it("says which of the two a diner asked for", () => {
    const request = { sessionId: "s1", restaurantId: "rest-1", branchId: "branch-1", label: "Table 4" } as never;

    listener.onServiceRaised({ request, kind: "bill" });
    listener.onServiceRaised({ request, kind: "waiter" });

    expect(notifyBranch.mock.calls.map(call => call[2].title)).toEqual(["Bill requested", "Waiter called"]);
  });
});
