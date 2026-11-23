import { buildAuthEntity } from "../../../../../common/testing";
import { SERVICE_RAISED } from "../../../../notifications/domain/constants";
import { ServiceRequestUsecase } from "../service-request.usecase";

const authUser = buildAuthEntity();
const session = {
  id: "s1",
  restaurantId: authUser.restaurantId,
  branchId: authUser.branchId,
  tableId: "t1",
  floorId: null,
  endedAt: null,
  waiterCalledAt: null,
  billRequestedAt: null,
};

describe("ServiceRequestUsecase pushes", () => {
  const emit = jest.fn();
  const emitAsync = jest.fn();
  const usecase = new ServiceRequestUsecase(
    {
      update: jest.fn().mockResolvedValue({ ...session, waiterCalledAt: new Date(), billRequestedAt: null }),
      findById: jest.fn().mockResolvedValue(session),
    } as never,
    { findById: jest.fn().mockResolvedValue({ name: "Table 4" }) } as never,
    { findById: jest.fn() } as never,
    { emit, emitAsync } as never
  );

  beforeEach(() => {
    emit.mockClear();
    emitAsync.mockClear();
  });

  it("raises a push event when a diner asks", async () => {
    await usecase.raise(session as never, "waiter");

    expect(emitAsync).toHaveBeenCalledWith(SERVICE_RAISED, expect.objectContaining({ kind: "waiter" }));
  });

  it("does not buzz the floor again when the same thing is asked while it is still open", async () => {
    await usecase.raise({ ...session, waiterCalledAt: new Date() } as never, "waiter");

    expect(emitAsync).not.toHaveBeenCalledWith(SERVICE_RAISED, expect.anything());
  });

  it("never raises one when staff clear the request", async () => {
    await usecase.clear("s1", "waiter", authUser);

    expect(emit).toHaveBeenCalledWith("service.requested", expect.anything());
    expect(emitAsync).not.toHaveBeenCalledWith(SERVICE_RAISED, expect.anything());
  });
});
