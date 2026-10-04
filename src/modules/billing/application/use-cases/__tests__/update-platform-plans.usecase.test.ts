import { Test } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { PlanRepository } from "../../../domain/repositories/plan.repository";
import { UpdatePlatformPlansUsecase } from "../update-platform-plans.usecase";
import { buildPlan } from "../../__tests__/billing.fixtures";

describe(UpdatePlatformPlansUsecase.name, () => {
  let usecase: UpdatePlatformPlansUsecase;
  const tx = {};
  const planRepository = {
    $transaction: jest.fn(),
    findAllActive: jest.fn(),
    countRestaurantsByPlanKey: jest.fn(),
    updateByKey: jest.fn(),
  };

  const item = {
    key: "growth",
    name: "Growth",
    monthlyPrice: 500000,
    annualPrice: 5000000,
    extraBranchPrice: null,
    extraSeatPrice: null,
    limits: { branches: 5 },
    features: { analyticsTier: "full" as const, exports: true },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    planRepository.$transaction.mockImplementation(fn => fn(tx));
    planRepository.findAllActive.mockResolvedValue([buildPlan()]);
    planRepository.countRestaurantsByPlanKey.mockResolvedValue({ growth: 2 });
    const module = await Test.createTestingModule({
      providers: [UpdatePlatformPlansUsecase, { provide: PlanRepository, useValue: planRepository }],
    }).compile();
    usecase = module.get(UpdatePlatformPlansUsecase);
  });

  describe("execute", () => {
    it("should update every plan in one transaction and return the catalogue with counts", async () => {
      // Arrange
      const { key, ...data } = item;

      // Act
      const result = await usecase.execute({ plans: [item] });

      // Assert
      expect(planRepository.updateByKey).toHaveBeenCalledWith(key, data, { tx });
      expect(result.counts).toEqual({ growth: 2 });
      expect(result.plans[0].key).toBe("growth");
    });

    it("should throw NotFoundException and write nothing when a plan key is unknown", async () => {
      // Arrange
      const unknown = { ...item, key: "ghost" };

      // Act & Assert
      await expect(usecase.execute({ plans: [item, unknown] })).rejects.toBeInstanceOf(NotFoundException);
      expect(planRepository.updateByKey).not.toHaveBeenCalled();
    });
  });
});
