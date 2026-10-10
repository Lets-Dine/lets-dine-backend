import { Test, TestingModule } from "@nestjs/testing";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { UsageRepository } from "../../../domain/repositories/usage.repository";
import { RenewalChargeService } from "../../renewal-charge.service";
import { buildPlan, buildSubscription } from "../../__tests__/billing.fixtures";
import { RollComplimentaryPeriodsUsecase } from "../roll-complimentary-periods.usecase";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("RollComplimentaryPeriodsUsecase", () => {
  let usecase: RollComplimentaryPeriodsUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RollComplimentaryPeriodsUsecase,
        RenewalChargeService,
        {
          provide: SubscriptionRepository,
          useValue: {
            findDueForInvoicing: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
          },
        },
        { provide: InvoiceRepository, useValue: { voidOpenForSubscription: jest.fn(), create: jest.fn(), fetchAll: jest.fn() } },
        {
          provide: UsageRepository,
          useValue: { countActiveBranches: jest.fn().mockResolvedValue(1), countActiveSeats: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    usecase = module.get(RollComplimentaryPeriodsUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    invoiceRepository = module.get(InvoiceRepository);
  });

  it("should look for subscriptions ending within the default 7-day lead", async () => {
    await usecase.execute(NOW);

    expect(subscriptionRepository.findDueForInvoicing).toHaveBeenCalledWith(new Date(NOW.getTime() + 7 * DAY_MS));
  });

  it("should honour a custom lead time", async () => {
    await usecase.execute(NOW, 14);

    expect(subscriptionRepository.findDueForInvoicing).toHaveBeenCalledWith(new Date(NOW.getTime() + 14 * DAY_MS));
  });

  it("should not create a renewal charge for a paid plan", async () => {
    subscriptionRepository.findDueForInvoicing.mockResolvedValue([buildSubscription()]);

    const result = await usecase.execute(NOW);

    expect(result.rolled).toBe(0);
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.update).not.toHaveBeenCalled();
  });

  it("should extend a plan that costs nothing without creating a charge", async () => {
    subscriptionRepository.findDueForInvoicing.mockResolvedValue([
      buildSubscription({ plan: buildPlan({ key: "enterprise", monthlyPrice: 0, annualPrice: 0 }) }),
    ]);

    const result = await usecase.execute(NOW);

    expect(result.rolled).toBe(1);
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", expect.anything());
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "ACTIVE",
        currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      }),
      expect.anything()
    );
  });

  it("should switch to a queued downgrade when that plan also costs nothing", async () => {
    const starter = buildPlan({ id: "plan-starter", key: "starter", name: "Starter", monthlyPrice: 0, annualPrice: 0 });
    subscriptionRepository.findDueForInvoicing.mockResolvedValue([buildSubscription({ pendingPlanId: starter.id, pendingPlan: starter })]);

    await usecase.execute(NOW);

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ planId: "plan-starter", pendingPlanId: null }),
      expect.anything()
    );
  });
});
