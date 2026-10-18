import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";

export type OnboardingStepKey = "brand" | "fees" | "categories" | "dishes" | "tables" | "staff" | "first-order";

export interface IOnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  /** Skippable: a restaurant with no tax or no staff beyond the owner is still set up. */
  optional: boolean;
}

export interface IOnboardingProgress {
  steps: IOnboardingStep[];
  completed: number;
  total: number;
}

/** The first-run checklist, derived from what already exists so it can never drift from reality. Labels and links live in the web app. */
@Injectable()
export class FetchOnboardingProgressUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(authEntity: AuthEntity): Promise<IOnboardingProgress> {
    const { restaurantId, branchId } = authEntity;
    const [restaurant, signals] = await Promise.all([
      this.restaurantRepository.findByIdForBranch(restaurantId, branchId),
      this.restaurantRepository.countSetupSignals(restaurantId, branchId),
    ]);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const steps: IOnboardingStep[] = [
      { key: "brand", done: Boolean(restaurant.logoUrl), optional: false },
      { key: "fees", done: restaurant.taxRate > 0 || restaurant.serviceChargeRate > 0, optional: true },
      { key: "categories", done: signals.categories > 0, optional: false },
      { key: "dishes", done: signals.dishes > 0, optional: false },
      { key: "tables", done: signals.tables > 0, optional: false },
      { key: "staff", done: signals.activeMembers > 1, optional: true },
      { key: "first-order", done: signals.orders > 0, optional: false },
    ];
    return { steps, completed: steps.filter(s => s.done).length, total: steps.length };
  }
}
