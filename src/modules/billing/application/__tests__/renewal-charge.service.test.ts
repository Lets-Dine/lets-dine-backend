import { Test, TestingModule } from "@nestjs/testing";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { UsageRepository } from "../../domain/repositories/usage.repository";
import { RenewalChargeService } from "../renewal-charge.service";
import { buildInvoice, buildPlan, buildSubscription } from "./billing.fixtures";

const NOW = new Date("2026-03-28T00:00:00.000Z");

describe("RenewalChargeService", () => {
  let service: RenewalChargeService;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let usageRepository: jest.Mocked<UsageRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalChargeService,
        {
          provide: InvoiceRepository,
          useValue: {
            create: jest.fn().mockImplementation(async data => buildInvoice({ ...data, id: "invoice-new" })),
            fetchAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
          },
        },
        {
          provide: UsageRepository,
          useValue: { countActiveBranches: jest.fn().mockResolvedValue(1), countActiveSeats: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    service = module.get(RenewalChargeService);
    invoiceRepository = module.get(InvoiceRepository);
    usageRepository = module.get(UsageRepository);
  });

  it("should price the next period at the plan price, due when that period starts", async () => {
    const quote = await service.quote(buildSubscription(), NOW);

    expect(quote.amount).toBe(400000);
    expect(quote.period).toEqual({
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-01T00:00:00.000Z"),
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("should price a queued downgrade at the downgrade's own price", async () => {
    const starter = buildPlan({ id: "plan-starter", key: "starter", name: "Starter", monthlyPrice: 150000, extraBranchPrice: null });

    const quote = await service.quote(buildSubscription({ pendingPlanId: starter.id, pendingPlan: starter }), NOW);

    expect(quote.amount).toBe(150000);
  });

  it("should include purchased extras and branches in use past the plan's limit", async () => {
    usageRepository.countActiveBranches.mockResolvedValue(7);

    const purchased = await service.quote(buildSubscription({ extraBranches: 2 }), NOW);
    const inUse = await service.quote(buildSubscription(), NOW);

    expect(purchased.amount).toBe(560000);
    expect(inUse.amount).toBe(400000 + 2 * 80000);
  });

  it("should reuse an open renewal instead of creating another", async () => {
    const open = buildInvoice({ id: "invoice-open" });
    invoiceRepository.fetchAll.mockResolvedValue({ rows: [open], count: 1 });

    const invoice = await service.ensureOpen(buildSubscription(), NOW);

    expect(invoice.id).toBe("invoice-open");
    expect(invoiceRepository.create).not.toHaveBeenCalled();
  });

  it("should create the renewal charge when none is open", async () => {
    const invoice = await service.ensureOpen(buildSubscription(), NOW);

    expect(invoice.amount).toBe(400000);
    expect(invoiceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "sub-1",
        kind: "RENEWAL",
        amount: 400000,
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
      })
    );
  });
});
