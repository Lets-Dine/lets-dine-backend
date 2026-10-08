import { Injectable } from "@nestjs/common";
import { TRIAL_DAYS, TRIAL_PLAN_KEY } from "../../domain/constants";
import { IPublicPlanCatalogue } from "../../domain/interfaces/billing.interface";
import { FetchPlansUsecase } from "./fetch-plans.usecase";

/**
 * The catalogue a visitor can read before they have an account.
 * Same plans an owner can switch to: public, active, subscription.
 * A private plan stays off this list, so a negotiated price is never published.
 */
@Injectable()
export class FetchPublicPlansUsecase {
  constructor(private readonly fetchPlansUsecase: FetchPlansUsecase) {}

  async execute(): Promise<IPublicPlanCatalogue> {
    const plans = await this.fetchPlansUsecase.execute();
    return { plans, trialDays: TRIAL_DAYS, trialPlanKey: TRIAL_PLAN_KEY };
  }
}
