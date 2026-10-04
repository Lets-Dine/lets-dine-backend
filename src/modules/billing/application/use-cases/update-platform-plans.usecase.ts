import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { IPlatformPlans } from "../../domain/interfaces/billing.interface";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { toPlanView } from "../../domain/utils/plan-view.util";
import { UpdatePlansInput } from "../../interfaces/http/validations/update-plans.validation";

/**
 * Saves the Plans page in one go: every edited plan or none. Subscriptions reference a plan by
 * id, so a new price reaches a restaurant when it next renews, and lowering a limit switches
 * nothing off — the entitlement service reports restaurants over a limit instead.
 */
@Injectable()
export class UpdatePlatformPlansUsecase {
  constructor(private readonly planRepository: PlanRepository) {}

  async execute(dto: UpdatePlansInput): Promise<IPlatformPlans> {
    await this.planRepository.$transaction(async tx => {
      const known = new Set((await this.planRepository.findAllActive({ tx })).map(plan => plan.key));
      if (dto.plans.some(plan => !known.has(plan.key))) throw new NotFoundException(BILLING_ERROR_MESSAGES.PLAN_NOT_FOUND);

      for (const { key, ...data } of dto.plans) {
        await this.planRepository.updateByKey(key, data, { tx });
      }
    });

    const [plans, counts] = await Promise.all([this.planRepository.findAllActive(), this.planRepository.countRestaurantsByPlanKey()]);
    return { plans: plans.map(plan => toPlanView(plan)), counts };
  }
}
