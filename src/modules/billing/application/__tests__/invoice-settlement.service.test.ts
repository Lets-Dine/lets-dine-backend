import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { PrismaTransaction } from "../../../../common/prisma";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { InvoiceSettlementService } from "../invoice-settlement.service";
import { ReferralRewardService } from "../referral-reward.service";
import { buildInvoice, buildSubscription } from "./billing.fixtures";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const tx = {} as PrismaTransaction;
const inTransaction = jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx));

describe("InvoiceSettlementService", () => {
  let service: InvoiceSettlementService;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let referralRewardService: jest.Mocked<ReferralRewardService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceSettlementService,
        {
          provide: InvoiceRepository,
          useValue: {
            $transaction: inTransaction,
            findById: jest.fn().mockResolvedValue(buildInvoice()),
            markPaidIfOpen: jest.fn().mockResolvedValue(true),
            voidOpenForSubscription: jest.fn().mockResolvedValue(0),
            recordAsExpense: jest.fn(),
          },
        },
        {
          provide: SubscriptionRepository,
          useValue: { $transaction: inTransaction, findDetailById: jest.fn().mockResolvedValue(buildSubscription()), update: jest.fn() },
        },
        { provide: ReferralRewardService, useValue: { grant: jest.fn() } },
      ],
    }).compile();

    service = module.get(InvoiceSettlementService);
    invoiceRepository = module.get(InvoiceRepository);
    subscriptionRepository = module.get(SubscriptionRepository);
    referralRewardService = module.get(ReferralRewardService);
  });

  describe("settle", () => {
    it("should close the invoice, record how it was paid and renew the subscription — all in one transaction", async () => {
      // Arrange
      invoiceRepository.findById.mockResolvedValueOnce(buildInvoice()).mockResolvedValueOnce(buildInvoice({ status: "PAID" }));

      // Act
      const paid = await service.settle("invoice-1", { paymentMethod: "bank", paymentRef: "TXN-9", markedPaidBy: null }, NOW);

      // Assert
      expect(paid.status).toBe("PAID");
      expect(invoiceRepository.markPaidIfOpen).toHaveBeenCalledWith(
        "invoice-1",
        { paidAt: NOW, paymentMethod: "bank", paymentRef: "TXN-9", markedPaidBy: null },
        { tx }
      );
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({ status: "ACTIVE", pastDueSince: null, currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z") }),
        { tx }
      );
    });

    it("should book a paid invoice as a ledger expense, but not a free one", async () => {
      // Arrange
      invoiceRepository.findById.mockResolvedValue(buildInvoice());

      // Act
      await service.settle("invoice-1", { paymentMethod: "bank" }, NOW);

      // Assert
      expect(invoiceRepository.recordAsExpense).toHaveBeenCalledTimes(1);
      expect(referralRewardService.grant).toHaveBeenCalledWith("restaurant-1", NOW, tx);

      // Arrange — a zero invoice
      invoiceRepository.recordAsExpense.mockClear();
      referralRewardService.grant.mockClear();
      invoiceRepository.findById.mockResolvedValue(buildInvoice({ amount: 0 }));

      // Act
      await service.settle("invoice-1", { paymentMethod: "none" }, NOW);

      // Assert
      expect(invoiceRepository.recordAsExpense).not.toHaveBeenCalled();
      expect(referralRewardService.grant).not.toHaveBeenCalled();
    });

    it("should switch the plan, not the paid window, when an upgrade invoice is paid", async () => {
      // Arrange
      invoiceRepository.findById.mockResolvedValue(buildInvoice({ kind: "UPGRADE", upgradePlanId: "plan-growth" }));

      // Act
      await service.settle("invoice-1", { paymentMethod: "esewa" }, NOW);

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", { planId: "plan-growth", pendingPlanId: null }, { tx });
    });

    it("should void any other open invoice of the subscription, now that the period is paid", async () => {
      // Act
      await service.settle("invoice-1", { paymentMethod: "bank" }, NOW);

      // Assert
      expect(invoiceRepository.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", { tx, exceptId: "invoice-1" });
    });

    it("should bring a suspended subscription back to active", async () => {
      // Arrange
      subscriptionRepository.findDetailById.mockResolvedValue(
        buildSubscription({ status: "SUSPENDED", pastDueSince: new Date("2026-02-01T00:00:00.000Z") })
      );

      // Act
      await service.settle("invoice-1", { paymentMethod: "bank" }, NOW);

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({ status: "ACTIVE", pastDueSince: null }),
        { tx }
      );
    });

    it("should throw NotFoundException for an invoice that does not exist", async () => {
      // Arrange
      invoiceRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.settle("missing", { paymentMethod: "bank" }, NOW)).rejects.toBeInstanceOf(NotFoundException);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it.each(["PAID", "VOID"] as const)("should refuse an invoice that is already %s, changing nothing", async status => {
      // Arrange
      invoiceRepository.findById.mockResolvedValue(buildInvoice({ status }));

      // Act & Assert
      await expect(service.settle("invoice-1", { paymentMethod: "bank" }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      expect(invoiceRepository.markPaidIfOpen).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should refuse when somebody else closed the invoice between the read and the write, and not renew twice", async () => {
      // Arrange
      invoiceRepository.markPaidIfOpen.mockResolvedValue(false);

      // Act & Assert
      await expect(service.settle("invoice-1", { paymentMethod: "bank" }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the invoice's subscription is gone", async () => {
      // Arrange
      subscriptionRepository.findDetailById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.settle("invoice-1", { paymentMethod: "bank" }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
