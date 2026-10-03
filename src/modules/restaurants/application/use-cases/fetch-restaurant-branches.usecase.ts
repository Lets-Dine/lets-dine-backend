import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { IPublicBranch, toPublicBranch } from "../../../branches/domain/utils/branch-hours.util";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";

/** The public "where can I eat" list behind a restaurant's page: its active branches, hours and whether each is open now. */
@Injectable()
export class FetchRestaurantBranchesUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly branchRepository: BranchRepository
  ) {}

  async execute(slug: string): Promise<IPublicBranch[]> {
    const restaurant = await this.restaurantRepository.findBySlug(slug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const now = new Date();
    const branches = await this.branchRepository.findActiveWithHours(restaurant.id);
    return branches.map(branch => toPublicBranch(branch, now));
  }
}
