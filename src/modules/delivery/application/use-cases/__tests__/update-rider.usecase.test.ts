import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { UpdateRiderUsecase } from "../update-rider.usecase";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const RIDER_ID = "66666666-6666-4666-8666-666666666666";
const PARTNER_ID = "77777777-7777-4777-8777-777777777777";
const current = { id: RIDER_ID, ...scope, name: "Ramesh", partnerId: null, payModel: "PER_DELIVERY", payValue: 6000 };

function build(over: Record<string, unknown> = {}) {
  const repo = {
    findRider: jest.fn().mockResolvedValue(current),
    findPartner: jest.fn().mockResolvedValue({ id: PARTNER_ID, ...scope }),
    updateRider: jest.fn().mockImplementation(async (_id, data) => ({ ...current, ...data })),
    ...over,
  };
  const audit = { record: jest.fn() };
  return { repo, audit, usecase: new UpdateRiderUsecase(repo as unknown as DeliveryRepository, audit as unknown as AuditLogService) };
}

describe("UpdateRiderUsecase", () => {
  describe("execute", () => {
    it("should drop the per-delivery rate when a rider moves under a partner", async () => {
      // Arrange
      const { repo, usecase } = build();

      // Act
      await usecase.execute(RIDER_ID, { partnerId: PARTNER_ID }, authUser);

      // Assert
      expect(repo.updateRider).toHaveBeenCalledWith(
        RIDER_ID,
        expect.objectContaining({ partnerId: PARTNER_ID, payModel: "SALARIED", payValue: 0 }),
        authUser.sub
      );
    });

    it("should log a plain on/off toggle as such", async () => {
      // Arrange
      const { audit, usecase } = build();

      // Act
      await usecase.execute(RIDER_ID, { isActive: false }, authUser);

      // Assert
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "courier_saved", detail: "Taken off duty" }), authUser);
    });

    it("should treat another branch's rider as missing", async () => {
      const { repo, usecase } = build({ findRider: jest.fn().mockResolvedValue({ ...current, branchId: "other-branch" }) });

      await expect(usecase.execute(RIDER_ID, { name: "New name" }, authUser)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.updateRider).not.toHaveBeenCalled();
    });
  });
});
