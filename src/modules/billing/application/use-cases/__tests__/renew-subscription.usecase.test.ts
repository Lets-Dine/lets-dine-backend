import { Test, TestingModule } from "@nestjs/testing";
import { AuthEntity } from "../../../../../common/interfaces";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { EsewaCheckoutService } from "../../esewa-checkout.service";
import { InvoiceSettlementService } from "../../invoice-settlement.service";
import { RenewalChargeService } from "../../renewal-charge.service";
import { buildInvoice, buildSubscription } from "../../__tests__/billing.fixtures";
import { RenewSubscriptionUsecase } from "../renew-subscription.usecase";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const auth = { restaurantId: "restaurant-1" } as AuthEntity;
const period = {
  periodStart: new Date("2026-04-01T00:00:00.000Z"),
  periodEnd: new Date("2026-05-01T00:00:00.000Z"),
  dueAt: new Date("2026-04-01T00:00:00.000Z"),
};

describe("RenewSubscriptionUsecase", () => {
  let usecase: RenewSubscriptionUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let charges: jest.Mocked<RenewalChargeService>;
  let settlement: jest.Mocked<InvoiceSettlementService>;
  let esewa: jest.Mocked<EsewaCheckoutService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewSubscriptionUsecase,
        {
          provide: SubscriptionRepository,
          useValue: {
            findDetailByRestaurantId: jest.fn().mockResolvedValue(buildSubscription()),
            update: jest.fn(),
            $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
          },
        },
        { provide: InvoiceRepository, useValue: { voidOpenForSubscription: jest.fn() } },
        {
          provide: RenewalChargeService,
          useValue: {
            findOpenRenewal: jest.fn().mockResolvedValue(null),
            quote: jest.fn().mockResolvedValue({ lines: [], amount: 400000, currency: "NPR", period }),
            ensureOpen: jest.fn().mockResolvedValue(buildInvoice()),
          },
        },
        { provide: InvoiceSettlementService, useValue: { settle: jest.fn() } },
        { provide: EsewaCheckoutService, useValue: { start: jest.fn().mockResolvedValue({ url: "https://esewa.test", fields: {} }) } },
      ],
    }).compile();

    usecase = module.get(RenewSubscriptionUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    charges = module.get(RenewalChargeService);
    settlement = module.get(InvoiceSettlementService);
    esewa = module.get(EsewaCheckoutService);
  });

  it("should refuse when the period is still more than a week away and nothing is already open", async () => {
    subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(
      buildSubscription({ currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY_MS) })
    );

    await expect(usecase.execute(auth, NOW)).rejects.toThrow();
    expect(charges.ensureOpen).not.toHaveBeenCalled();
  });

  it("should start eSewa for a renewal that is due", async () => {
    const result = await usecase.execute(auth, NOW);

    expect(charges.ensureOpen).toHaveBeenCalled();
    expect(esewa.start).toHaveBeenCalledWith("invoice-1", "restaurant-1", NOW);
    expect(result.settled).toBe(false);
    expect(result.checkout?.url).toBe("https://esewa.test");
  });

  it("should reuse an open renewal even before the lead window", async () => {
    subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(
      buildSubscription({ currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY_MS) })
    );
    charges.findOpenRenewal.mockResolvedValue(buildInvoice({ id: "invoice-open" }));
    charges.ensureOpen.mockResolvedValue(buildInvoice({ id: "invoice-open" }));

    await usecase.execute(auth, NOW);

    expect(esewa.start).toHaveBeenCalledWith("invoice-open", "restaurant-1", NOW);
  });

  it("should extend a plan that costs nothing without creating a charge", async () => {
    charges.quote.mockResolvedValue({ lines: [], amount: 0, currency: "NPR", period });

    const result = await usecase.execute(auth, NOW);

    expect(result).toEqual({ settled: true, checkout: null });
    expect(charges.ensureOpen).not.toHaveBeenCalled();
    expect(subscriptionRepository.update).toHaveBeenCalled();
    expect(settlement.settle).not.toHaveBeenCalled();
  });
});
