import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../../domain/constants";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { AssignDeliveryUsecase } from "../assign-delivery.usecase";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const ORDER_ID = "55555555-5555-4555-8555-555555555555";
const RIDER_ID = "66666666-6666-4666-8666-666666666666";
const PARTNER_ID = "77777777-7777-4777-8777-777777777777";

const order = {
  id: ORDER_ID,
  reference: "#1042",
  ...scope,
  orderType: "DELIVERY",
  status: "READY",
  total: 105000,
  deliveryCustomerName: "Mira",
};
const rider = { id: RIDER_ID, ...scope, name: "Ramesh", partnerId: null, isActive: true };
const partner = { id: PARTNER_ID, ...scope, name: "Roadrunner", isActive: true, collectsCash: true };
const dto = { riderId: RIDER_ID, partnerId: null, courierFee: 6000, cashToCollect: 105000 };

function build(over: Record<string, unknown> = {}) {
  const repo = {
    $transaction: jest.fn(fn => fn({})),
    findOrder: jest.fn().mockResolvedValue(order),
    findRider: jest.fn().mockResolvedValue(rider),
    findPartner: jest.fn().mockResolvedValue(partner),
    deleteOpenAssignments: jest.fn(),
    createAssignment: jest.fn().mockImplementation(async data => ({ id: "run-1", ...data })),
    ...over,
  };
  const audit = { record: jest.fn() };
  return { repo, audit, usecase: new AssignDeliveryUsecase(repo as unknown as DeliveryRepository, audit as unknown as AuditLogService) };
}

describe("AssignDeliveryUsecase", () => {
  describe("execute", () => {
    it("should file a rider's run under the rider's own account and replace any open run", async () => {
      // Arrange
      const { repo, audit, usecase } = build();

      // Act
      await usecase.execute(ORDER_ID, dto, authUser);

      // Assert
      expect(repo.deleteOpenAssignments).toHaveBeenCalledWith(scope, ORDER_ID, expect.anything());
      expect(repo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          accountKind: "RIDER",
          accountId: RIDER_ID,
          riderName: "Ramesh",
          partnerName: null,
          courierFee: 6000,
          cashToCollect: 105000,
        }),
        expect.anything()
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "delivery_dispatched" }), authUser, expect.anything());
    });

    it("should file a partner's rider under the partner's account", async () => {
      // Arrange
      const { repo, usecase } = build({ findRider: jest.fn().mockResolvedValue({ ...rider, partnerId: PARTNER_ID }) });

      // Act
      await usecase.execute(ORDER_ID, dto, authUser);

      // Assert
      expect(repo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          accountKind: "PARTNER",
          accountId: PARTNER_ID,
          riderId: RIDER_ID,
          partnerId: PARTNER_ID,
          partnerName: "Roadrunner",
        }),
        expect.anything()
      );
    });

    it("should refuse when no courier is chosen", async () => {
      const { usecase } = build();

      await expect(usecase.execute(ORDER_ID, { ...dto, riderId: null }, authUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should treat another branch's order as missing", async () => {
      const { repo, usecase } = build({ findOrder: jest.fn().mockResolvedValue({ ...order, branchId: "other-branch" }) });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.createAssignment).not.toHaveBeenCalled();
    });

    it("should refuse a dine-in order", async () => {
      const { usecase } = build({ findOrder: jest.fn().mockResolvedValue({ ...order, orderType: "DINE_IN" }) });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.NOT_A_DELIVERY_ORDER.message,
      });
    });

    it("should refuse an order that is already finished", async () => {
      const { usecase } = build({ findOrder: jest.fn().mockResolvedValue({ ...order, status: "COMPLETED" }) });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(ConflictException);
    });

    it("should refuse a switched-off rider", async () => {
      const { usecase } = build({ findRider: jest.fn().mockResolvedValue({ ...rider, isActive: false }) });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(ConflictException);
    });

    it("should refuse cash to collect above the order total", async () => {
      const { usecase } = build();

      await expect(usecase.execute(ORDER_ID, { ...dto, cashToCollect: 105001 }, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.CASH_EXCEEDS_TOTAL.message,
      });
    });

    it("should refuse cash to collect from a partner that does not collect", async () => {
      const { usecase } = build({ findPartner: jest.fn().mockResolvedValue({ ...partner, collectsCash: false }) });

      await expect(usecase.execute(ORDER_ID, { ...dto, riderId: null, partnerId: PARTNER_ID }, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.PARTNER_DOES_NOT_COLLECT.message,
      });
    });

    it("should refuse a rider who rides for a different partner than the one chosen", async () => {
      const { usecase } = build({
        findRider: jest.fn().mockResolvedValue({ ...rider, partnerId: "88888888-8888-4888-8888-888888888888" }),
      });

      await expect(usecase.execute(ORDER_ID, { ...dto, partnerId: PARTNER_ID }, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.RIDER_PARTNER_MISMATCH.message,
      });
    });
  });
});
