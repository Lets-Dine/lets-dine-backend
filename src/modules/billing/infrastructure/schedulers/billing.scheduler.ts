import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GenerateInvoicesUsecase, IGenerateInvoicesResult } from "../../application/use-cases/generate-invoices.usecase";
import { IRunLifecycleResult, RunLifecycleUsecase } from "../../application/use-cases/run-lifecycle.usecase";
import { DEFAULT_BILLING_CRON, DEFAULT_BILLING_CRON_TIMEZONE } from "../../domain/constants";

export interface IBillingCycleResult {
  /** Null when that step failed or the cycle was skipped. */
  invoices: IGenerateInvoicesResult | null;
  lifecycle: IRunLifecycleResult | null;
  /** One message per step that threw — a failing step never stops the other. */
  errors: string[];
}

/**
 * The daily billing cycle: issue renewal invoices, then move subscriptions along
 * their lifecycle. It only calls the same two idempotent use cases the platform
 * endpoints expose, so a run that is missed (server down overnight) is made up for
 * by the next one, and an operator can still trigger either by hand.
 *
 * Invoices go first on purpose: a free plan's renewal settles itself, and doing it
 * before the lifecycle sweep stops a period that lapsed overnight being marked
 * overdue for a payment that was never owed.
 *
 * It runs inside the app process, so with several instances only one should have it
 * switched on (`BILLING_SCHEDULER_ENABLED=false` on the rest) — both steps are safe to
 * repeat, but two at once would race to invoice the same subscription.
 */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);
  private running = false;

  constructor(
    private readonly generateInvoicesUsecase: GenerateInvoicesUsecase,
    private readonly runLifecycleUsecase: RunLifecycleUsecase
  ) {}

  @Cron(process.env.BILLING_CRON ?? DEFAULT_BILLING_CRON, {
    name: "billing-daily-cycle",
    timeZone: process.env.BILLING_CRON_TIMEZONE ?? DEFAULT_BILLING_CRON_TIMEZONE,
  })
  async handleDailyCycle(): Promise<void> {
    if (process.env.BILLING_SCHEDULER_ENABLED === "false") return;
    await this.runCycle();
  }

  async runCycle(now: Date = new Date()): Promise<IBillingCycleResult> {
    const result: IBillingCycleResult = { invoices: null, lifecycle: null, errors: [] };

    if (this.running) {
      this.logger.warn("Billing cycle skipped: the previous run is still going");
      return result;
    }
    this.running = true;

    try {
      try {
        result.invoices = await this.generateInvoicesUsecase.execute({}, now);
      } catch (error) {
        this.recordFailure(result, "invoice generation", error);
      }

      try {
        result.lifecycle = await this.runLifecycleUsecase.execute(now);
      } catch (error) {
        this.recordFailure(result, "lifecycle sweep", error);
      }
    } finally {
      this.running = false;
    }

    this.logger.log(
      `Billing cycle done: ${result.invoices?.generated.length ?? "failed"} invoice(s) issued, ` +
        `${result.lifecycle ? `${result.lifecycle.transitions.length} of ${result.lifecycle.checked} subscription(s) moved` : "lifecycle failed"}`
    );

    return result;
  }

  private recordFailure(result: IBillingCycleResult, step: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`${step}: ${message}`);
    this.logger.error(`Billing ${step} failed`, error instanceof Error ? error.stack : message);
  }
}
