import { Injectable } from "@nestjs/common";
import { IPlatformPlans } from "../../domain/interfaces/billing.interface";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { toPlanView } from "../../domain/utils/plan-view.util";

/** The whole plan catalogue for the platform Plans page, with how many restaurants sit on each plan. */
@Injectable()
export class FetchPlatformPlansUsecase {
  constructor(private readonly planRepository: PlanRepository) {}

  async execute(): Promise<IPlatformPlans> {
    const [plans, counts] = await Promise.all([this.planRepository.findAllActive(), this.planRepository.countRestaurantsByPlanKey()]);
    return { plans: plans.map(plan => toPlanView(plan)), counts };
  }
}
