import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { IRollComplimentaryResult, RollComplimentaryPeriodsUsecase } from "../../application/use-cases/roll-complimentary-periods.usecase";
import { IRunLifecycleResult, RunLifecycleUsecase } from "../../application/use-cases/run-lifecycle.usecase";
import { DEFAULT_BILLING_CRON, DEFAULT_BILLING_CRON_TIMEZONE } from "../../domain/constants";

export interface IBillingCycleResult {
  /** Null when that step failed or the cycle was skipped. */
  rolled: IRollComplimentaryResult | null;
  lifecycle: IRunLifecycleResult | null;
  /** One message per step that threw — a failing step never stops the other. */
  errors: string[];
}

/**
 * The daily billing cycle: extend plans that cost nothing, then move subscriptions
 * along their lifecycle. A paid plan is not billed here. The restaurant is reminded
 * to renew, and the charge is created when they pay.
 *
 * Complimentary plans go first on purpose: doing it before the lifecycle sweep
 * stops a period that lapsed overnight being marked overdue for a payment that
 * was never owed.
 *
 * It runs inside the app process, so with several instances only one should have it
 * switched on (`BILLING_SCHEDULER_ENABLED=false` on the rest) — both steps are safe to
 * repeat, but two at once would race to extend the same subscription.
 */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);
  private running = false;

  constructor(
    private readonly rollComplimentaryPeriodsUsecase: RollComplimentaryPeriodsUsecase,
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
    const result: IBillingCycleResult = { rolled: null, lifecycle: null, errors: [] };

    if (this.running) {
      this.logger.warn("Billing cycle skipped: the previous run is still going");
      return result;
    }
    this.running = true;

    try {
      try {
        result.rolled = await this.rollComplimentaryPeriodsUsecase.execute(now);
      } catch (error) {
        this.recordFailure(result, "complimentary renewal", error);
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
      `Billing cycle done: ${result.rolled?.rolled ?? "failed"} complimentary period(s) extended, ` +
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
