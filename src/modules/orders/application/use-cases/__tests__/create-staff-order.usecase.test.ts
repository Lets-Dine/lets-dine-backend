import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { AuthEntity } from "../../../../../common/interfaces";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../../dining-sessions/domain/constants";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { CreateStaffOrderUsecase } from "../create-staff-order.usecase";

const auth = { sub: "user-1", restaurantId: "restaurant-1", branchId: "branch-1" } as AuthEntity;
const lines = [{ dishId: "00000000-0000-4000-8000-000000000001", quantity: 1, addOnIds: [] }];
const tableSession = { id: "session-1", restaurantId: "restaurant-1", branchId: "branch-1", tableId: "table-1" };
const placed = { id: "order-1", status: "PENDING", restaurantId: "restaurant-1", branchId: "branch-1" };
const accepted = { ...placed, status: "ACCEPTED" };
const occupied = () => new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED);

function setup() {
  const orderRepository = {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    findBySessionId: jest.fn().mockResolvedValue([]),
  };
  const diningSessionRepository = {
    findOpenByTableId: jest.fn(),
    create: jest.fn(async (data: object) => ({ id: "session-new", ...data })),
    update: jest.fn(),
  };
  const floorRepository = { findById: jest.fn() };
  const customerRepository = {
    findByPhone: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(async (data: object) => ({ id: "customer-1", ...data })),
  };
  const startTableSessionUsecase = { execute: jest.fn() };
  const endDiningSessionUsecase = { execute: jest.fn().mockResolvedValue(undefined) };
  const createOrderUsecase = { execute: jest.fn().mockResolvedValue(placed) };
  const updateOrderStatusUsecase = { execute: jest.fn().mockResolvedValue(accepted) };
  const usecase = new CreateStaffOrderUsecase(
    orderRepository as any,
    diningSessionRepository as any,
    floorRepository as any,
    customerRepository as any,
    startTableSessionUsecase as any,
    endDiningSessionUsecase as any,
    createOrderUsecase as any,
    updateOrderStatusUsecase as any
  );
  return {
    usecase,
    orderRepository,
    diningSessionRepository,
    customerRepository,
    startTableSessionUsecase,
    endDiningSessionUsecase,
    createOrderUsecase,
    updateOrderStatusUsecase,
  };
}

const tableOrder = { type: "TABLE", tableId: "table-1", lines } as any;

describe("CreateStaffOrderUsecase", () => {
  it("seats a free table, places the order there and sends it straight to the kitchen", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValueOnce(null).mockResolvedValueOnce(tableSession);

    const order = await m.usecase.execute(tableOrder, auth, { idempotencyKey: "k1" });

    expect(m.startTableSessionUsecase.execute).toHaveBeenCalledWith("table-1", auth);
    expect(m.createOrderUsecase.execute).toHaveBeenCalledWith(tableOrder, tableSession, { idempotencyKey: "k1", placedByStaff: true });
    expect(m.updateOrderStatusUsecase.execute).toHaveBeenCalledWith("order-1", { status: "ACCEPTED" }, auth);
    expect(order).toBe(accepted);
  });

  it("adds to a table's running visit without seating it again", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValue(tableSession);

    await m.usecase.execute(tableOrder, auth);

    expect(m.startTableSessionUsecase.execute).not.toHaveBeenCalled();
    expect(m.createOrderUsecase.execute).toHaveBeenCalledWith(expect.anything(), tableSession, expect.anything());
  });

  it("joins the visit when someone else seated the table a moment earlier, and never ends it", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValueOnce(null).mockResolvedValueOnce(tableSession);
    m.startTableSessionUsecase.execute.mockRejectedValue(occupied());
    m.createOrderUsecase.execute.mockRejectedValue(new Error("dish gone"));

    await expect(m.usecase.execute(tableOrder, auth)).rejects.toThrow("dish gone");
    expect(m.endDiningSessionUsecase.execute).not.toHaveBeenCalled();
  });

  it("passes on an inactive table's refusal instead of treating it as already seated", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValue(null);
    m.startTableSessionUsecase.execute.mockRejectedValue(new ConflictException({ key: "DINING_TABLE_INACTIVE", message: "inactive" }));

    await expect(m.usecase.execute(tableOrder, auth)).rejects.toThrow("inactive");
    expect(m.createOrderUsecase.execute).not.toHaveBeenCalled();
  });

  it("un-seats a table it seated when the order then fails", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValueOnce(null).mockResolvedValue(tableSession);
    m.createOrderUsecase.execute.mockRejectedValue(new Error("branch closed"));

    await expect(m.usecase.execute(tableOrder, auth)).rejects.toThrow("branch closed");
    expect(m.endDiningSessionUsecase.execute).toHaveBeenCalledWith("table-1", auth);
  });

  it("leaves a visit it seated alone once someone else has ordered on it", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValueOnce(null).mockResolvedValue(tableSession);
    m.createOrderUsecase.execute.mockRejectedValue(new Error("dish gone"));
    m.orderRepository.findBySessionId.mockResolvedValue([{ id: "diner-order" }]);

    await expect(m.usecase.execute(tableOrder, auth)).rejects.toThrow("dish gone");
    expect(m.endDiningSessionUsecase.execute).not.toHaveBeenCalled();
  });

  it("answers a same-key race with the order that won it", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValueOnce(null).mockResolvedValue(tableSession);
    m.createOrderUsecase.execute.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    m.orderRepository.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(accepted);
    m.orderRepository.findBySessionId.mockResolvedValue([accepted]);

    const order = await m.usecase.execute(tableOrder, auth, { idempotencyKey: "k1" });

    expect(order).toBe(accepted);
    expect(m.endDiningSessionUsecase.execute).not.toHaveBeenCalled();
  });

  it("still returns the committed order when accepting it fails", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValue(tableSession);
    m.updateOrderStatusUsecase.execute.mockRejectedValue(new Error("already accepted"));
    m.orderRepository.findById.mockResolvedValue(accepted);

    expect(await m.usecase.execute(tableOrder, auth)).toBe(accepted);
  });

  it("accepts a replayed order that was left pending", async () => {
    const m = setup();
    m.orderRepository.findByIdempotencyKey.mockResolvedValue(placed);

    const order = await m.usecase.execute({ type: "FLOOR", floorId: "floor-1", lines } as any, auth, { idempotencyKey: "k1" });

    expect(order).toBe(accepted);
    expect(m.diningSessionRepository.create).not.toHaveBeenCalled();
  });

  it("refuses to replay another branch's order", async () => {
    const m = setup();
    m.orderRepository.findByIdempotencyKey.mockResolvedValue({ ...accepted, branchId: "branch-2" });

    await expect(m.usecase.execute(tableOrder, auth, { idempotencyKey: "k1" })).rejects.toMatchObject({
      exception: ORDER_ERROR_MESSAGES.IDEMPOTENCY_KEY_REUSED,
    });
  });

  it("delivers a regular to their saved address without rewriting their record", async () => {
    const m = setup();
    m.customerRepository.findByPhone.mockResolvedValue({ id: "customer-9", defaultAddress: "Baneshwor" });

    await m.usecase.execute({ type: "DELIVERY", customer: { phone: "9800000000", name: "Hari" }, lines } as any, auth);

    expect(m.customerRepository.upsert).not.toHaveBeenCalled();
    expect(m.diningSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "customer-9", branchId: "branch-1" })
    );
    expect(m.createOrderUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAddress: "Baneshwor" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("saves a new delivery customer with the address staff typed", async () => {
    const m = setup();

    await m.usecase.execute(
      { type: "DELIVERY", customer: { phone: "9800000000", name: "Hari" }, deliveryAddress: " Thamel ", lines } as any,
      auth
    );

    expect(m.customerRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({ phone: "9800000000", defaultAddress: "Thamel" }));
  });

  it("refuses a delivery with nowhere to deliver to", async () => {
    const m = setup();
    await expect(
      m.usecase.execute({ type: "DELIVERY", customer: { phone: "9800000000", name: "Hari" }, lines } as any, auth)
    ).rejects.toMatchObject({ exception: ORDER_ERROR_MESSAGES.DELIVERY_ADDRESS_REQUIRED });
    expect(m.diningSessionRepository.create).not.toHaveBeenCalled();
  });

  it("refuses another branch's table visit", async () => {
    const m = setup();
    m.diningSessionRepository.findOpenByTableId.mockResolvedValue({ ...tableSession, branchId: "branch-2" });
    await expect(m.usecase.execute(tableOrder, auth)).rejects.toBeInstanceOf(NotFoundException);
  });
});
