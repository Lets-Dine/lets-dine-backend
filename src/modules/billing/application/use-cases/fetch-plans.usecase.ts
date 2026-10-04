import { Injectable } from "@nestjs/common";
import { IPlanView } from "../../domain/interfaces/billing.interface";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { toPlanView } from "../../domain/utils/plan-view.util";

/** The plans an owner may switch to on their own. */
@Injectable()
export class FetchPlansUsecase {
  constructor(private readonly planRepository: PlanRepository) {}

  async execute(): Promise<IPlanView[]> {
    const plans = await this.planRepository.findSelfServe();
    return plans.map(plan => toPlanView(plan));
  }
}
