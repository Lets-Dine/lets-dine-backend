import { Global, Module } from "@nestjs/common";
import { StaffAccessPolicy } from "../../common/auth";
import { EntitlementService } from "./application/entitlement.service";
import { EsewaCheckoutService } from "./application/esewa-checkout.service";
import { InvoiceSettlementService } from "./application/invoice-settlement.service";
import { SubscriptionStaffAccessPolicy } from "./application/subscription-staff-access.policy";
import { SubscriptionService } from "./application/subscription.service";
import { AssignPlanUsecase } from "./application/use-cases/assign-plan.usecase";
import { ChangePlanUsecase } from "./application/use-cases/change-plan.usecase";
import { FetchInvoicesUsecase } from "./application/use-cases/fetch-invoices.usecase";
import { FetchPlatformTenantCountsUsecase } from "./application/use-cases/fetch-platform-tenant-counts.usecase";
import { FetchPlatformTenantsUsecase } from "./application/use-cases/fetch-platform-tenants.usecase";
import { FetchPlatformPlansUsecase } from "./application/use-cases/fetch-platform-plans.usecase";
import { UpdatePlatformPlansUsecase } from "./application/use-cases/update-platform-plans.usecase";
import { FetchPlansUsecase } from "./application/use-cases/fetch-plans.usecase";
import { FetchPublicPlansUsecase } from "./application/use-cases/fetch-public-plans.usecase";
import { FetchPlatformInvoicesUsecase } from "./application/use-cases/fetch-platform-invoices.usecase";
import { FetchReferralsUsecase } from "./application/use-cases/fetch-referrals.usecase";
import { FetchSubscriptionUsecase } from "./application/use-cases/fetch-subscription.usecase";
import { FetchUsageUsecase } from "./application/use-cases/fetch-usage.usecase";
import { RecordRenewalPaymentUsecase } from "./application/use-cases/record-renewal-payment.usecase";
import { RenewSubscriptionUsecase } from "./application/use-cases/renew-subscription.usecase";
import { RollComplimentaryPeriodsUsecase } from "./application/use-cases/roll-complimentary-periods.usecase";
import { MarkInvoicePaidUsecase } from "./application/use-cases/mark-invoice-paid.usecase";
import { ReferralRewardService } from "./application/referral-reward.service";
import { RenewalChargeService } from "./application/renewal-charge.service";
import { RunLifecycleUsecase } from "./application/use-cases/run-lifecycle.usecase";
import { InvoiceRepository } from "./domain/repositories/invoice.repository";
import { PlanRepository } from "./domain/repositories/plan.repository";
import { SubscriptionRepository } from "./domain/repositories/subscription.repository";
import { TenantRepository } from "./domain/repositories/tenant.repository";
import { UsageRepository } from "./domain/repositories/usage.repository";
import InvoiceRepositoryImpl from "./infrastructure/repositories/invoice.repository.impl";
import PlanRepositoryImpl from "./infrastructure/repositories/plan.repository.impl";
import { BillingScheduler } from "./infrastructure/schedulers/billing.scheduler";
import SubscriptionRepositoryImpl from "./infrastructure/repositories/subscription.repository.impl";
import TenantRepositoryImpl from "./infrastructure/repositories/tenant.repository.impl";
import UsageRepositoryImpl from "./infrastructure/repositories/usage.repository.impl";
import { BillingController } from "./interfaces/http/billing.controller";
import { PublicPlansController } from "./interfaces/http/public-plans.controller";
import { SubscriptionActiveGuard } from "./interfaces/http/guards/subscription-active.guard";
import { PlatformBillingController } from "./interfaces/http/platform-billing.controller";

/**
 * Deliberately imports no feature module: branches, orders and the rest depend on
 * billing (through EntitlementService), never the other way round — billing reads
 * branch and seat counts straight from Prisma to keep that dependency one-way.
 *
 * Global because AuthGuard, used by nearly every module, asks the StaffAccessPolicy it
 * provides whether a staff member may still be in the app — listing it in every module's
 * imports would add nothing.
 */
@Global()
@Module({
  controllers: [BillingController, PublicPlansController, PlatformBillingController],
  providers: [
    EntitlementService,
    SubscriptionService,
    InvoiceSettlementService,
    ReferralRewardService,
    RenewalChargeService,
    EsewaCheckoutService,
    { provide: StaffAccessPolicy, useClass: SubscriptionStaffAccessPolicy },
    SubscriptionActiveGuard,
    FetchSubscriptionUsecase,
    FetchReferralsUsecase,
    FetchUsageUsecase,
    FetchPlansUsecase,
    FetchPublicPlansUsecase,
    FetchPlatformPlansUsecase,
    FetchPlatformTenantsUsecase,
    FetchPlatformTenantCountsUsecase,
    UpdatePlatformPlansUsecase,
    FetchInvoicesUsecase,
    ChangePlanUsecase,
    FetchPlatformInvoicesUsecase,
    RollComplimentaryPeriodsUsecase,
    RenewSubscriptionUsecase,
    RecordRenewalPaymentUsecase,
    MarkInvoicePaidUsecase,
    RunLifecycleUsecase,
    AssignPlanUsecase,
    BillingScheduler,
    SubscriptionRepositoryImpl,
    { provide: SubscriptionRepository, useExisting: SubscriptionRepositoryImpl },
    UsageRepositoryImpl,
    { provide: UsageRepository, useExisting: UsageRepositoryImpl },
    PlanRepositoryImpl,
    { provide: PlanRepository, useExisting: PlanRepositoryImpl },
    TenantRepositoryImpl,
    { provide: TenantRepository, useExisting: TenantRepositoryImpl },
    InvoiceRepositoryImpl,
    { provide: InvoiceRepository, useExisting: InvoiceRepositoryImpl },
  ],
  exports: [EntitlementService, SubscriptionService, SubscriptionActiveGuard, StaffAccessPolicy],
})
export class BillingModule {}
