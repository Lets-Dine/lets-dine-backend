import { Test, TestingModule } from "@nestjs/testing";
import { UsageRepository } from "../../../domain/repositories/usage.repository";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { InvoiceSettlementService } from "../../invoice-settlement.service";
import { buildInvoice, buildPlan, buildSubscription } from "../../__tests__/billing.fixtures";
import { GenerateInvoicesUsecase } from "../generate-invoices.usecase";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("GenerateInvoicesUsecase", () => {
  let usecase: GenerateInvoicesUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let usageRepository: jest.Mocked<UsageRepository>;
  let settlement: jest.Mocked<InvoiceSettlementService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateInvoicesUsecase,
        { provide: SubscriptionRepository, useValue: { findDueForInvoicing: jest.fn().mockResolvedValue([]) } },
        {
          provide: InvoiceRepository,
          useValue: { create: jest.fn().mockImplementation(async data => buildInvoice({ ...data, id: "invoice-new" })) },
        },
        {
          provide: UsageRepository,
          useValue: { countActiveBranches: jest.fn().mockResolvedValue(1), countActiveSeats: jest.fn().mockResolvedValue(1) },
        },
        { provide: InvoiceSettlementService, useValue: { settle: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(GenerateInvoicesUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    invoiceRepository = module.get(InvoiceRepository);
    usageRepository = module.get(UsageRepository);
    settlement = module.get(InvoiceSettlementService);
  });

  describe("execute", () => {
    it("should ask for subscriptions ending within the default 7-day lead time", async () => {
      // Act
      await usecase.execute({}, NOW);

      // Assert
      expect(subscriptionRepository.findDueForInvoicing).toHaveBeenCalledWith(new Date(NOW.getTime() + 7 * DAY_MS));
    });

    it("should honour a custom lead time", async () => {
      // Act
      await usecase.execute({ leadDays: 14 }, NOW);

      // Assert
      expect(subscriptionRepository.findDueForInvoicing).toHaveBeenCalledWith(new Date(NOW.getTime() + 14 * DAY_MS));
    });

    it("should issue the next period's invoice at the plan price, due when that period starts", async () => {
      // Arrange
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([buildSubscription()]);

      // Act
      const result = await usecase.execute({}, NOW);

      // Assert
      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: "sub-1",
          restaurantId: "restaurant-1",
          amount: 400000,
          currency: "NPR",
          periodStart: new Date("2026-04-01T00:00:00.000Z"),
          periodEnd: new Date("2026-05-01T00:00:00.000Z"),
          dueAt: new Date("2026-04-01T00:00:00.000Z"),
          number: expect.stringMatching(/^INV-20260401-/),
        })
      );
      expect(result.generated).toHaveLength(1);
      expect(result.autoSettled).toBe(0);
      expect(settlement.settle).not.toHaveBeenCalled();
    });

    it("should bill a queued downgrade at the downgrade's own price", async () => {
      // Arrange
      const starter = buildPlan({ id: "plan-starter", key: "starter", name: "Starter", monthlyPrice: 150000, extraBranchPrice: null });
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([
        buildSubscription({ pendingPlanId: starter.id, pendingPlan: starter }),
      ]);

      // Act
      await usecase.execute({}, NOW);

      // Assert
      expect(invoiceRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 150000 }));
    });

    it("should include purchased extras in the amount", async () => {
      // Arrange
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([buildSubscription({ extraBranches: 2 })]);

      // Act
      await usecase.execute({}, NOW);

      // Assert
      expect(invoiceRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 560000 }));
    });

    it("should settle a zero-cost invoice straight away, since there is nothing to wait for", async () => {
      // Arrange
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([
        buildSubscription({ plan: buildPlan({ key: "enterprise", monthlyPrice: 0, annualPrice: 0 }) }),
      ]);
      settlement.settle.mockResolvedValue(buildInvoice({ id: "invoice-new", status: "PAID", amount: 0 }));

      // Act
      const result = await usecase.execute({}, NOW);

      // Assert
      expect(settlement.settle).toHaveBeenCalledWith("invoice-new", { paymentMethod: "none" }, NOW);
      expect(result.autoSettled).toBe(1);
      expect(result.generated[0].status).toBe("PAID");
    });

    it("should invoice every due subscription and nothing when none are due", async () => {
      // Arrange
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([
        buildSubscription(),
        buildSubscription({ id: "sub-2", restaurantId: "restaurant-2" }),
      ]);

      // Act
      const result = await usecase.execute({}, NOW);
      subscriptionRepository.findDueForInvoicing.mockResolvedValue([]);
      const none = await usecase.execute({}, NOW);

      // Assert
      expect(result.generated).toHaveLength(2);
      expect(none.generated).toHaveLength(0);
    });
  });

  it("should bill branches in use past the plan's limit", async () => {
    // Arrange — Growth includes 5 branches; 7 are open
    subscriptionRepository.findDueForInvoicing.mockResolvedValue([buildSubscription()]);
    (usageRepository.countActiveBranches as jest.Mock).mockResolvedValue(7);

    // Act
    const { generated } = await usecase.execute({}, NOW);

    // Assert
    expect(generated[0].amount).toBe(400000 + 2 * 80000);
  });

  describe("executeForRestaurant", () => {
    const stub = (sub: unknown, open: unknown[] = []) => {
      (subscriptionRepository as unknown as { findDetailByRestaurantId: jest.Mock }).findDetailByRestaurantId = jest
        .fn()
        .mockResolvedValue(sub);
      (invoiceRepository as unknown as { fetchAll: jest.Mock }).fetchAll = jest.fn().mockResolvedValue({ rows: open, count: open.length });
    };

    it("should invoice one restaurant now, outside any lead window", async () => {
      stub(buildSubscription({ currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY_MS) }));

      const invoice = await usecase.executeForRestaurant("restaurant-1", NOW);

      expect(invoice.amount).toBe(400000);
      expect(invoiceRepository.create).toHaveBeenCalledTimes(1);
    });

    it("should refuse when an invoice is already open, a cancelled subscription, or an unknown restaurant", async () => {
      stub(buildSubscription(), [buildInvoice()]);
      await expect(usecase.executeForRestaurant("restaurant-1", NOW)).rejects.toThrow();
      stub(buildSubscription({ status: "CANCELLED" }));
      await expect(usecase.executeForRestaurant("restaurant-1", NOW)).rejects.toThrow();
      stub(null);
      await expect(usecase.executeForRestaurant("restaurant-1", NOW)).rejects.toThrow();
      expect(invoiceRepository.create).not.toHaveBeenCalled();
    });
  });
});
