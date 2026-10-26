import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { RequestRestaurantClaimUsecase } from "../request-restaurant-claim.usecase";

const dto = { name: "Sita", phone: "9800000000" };

function build(restaurant: object | null) {
  const repo = { findBySlug: jest.fn().mockResolvedValue(restaurant), createClaimRequest: jest.fn() };
  return { repo, usecase: new RequestRestaurantClaimUsecase(repo as unknown as RestaurantRepository) };
}

describe("RequestRestaurantClaimUsecase", () => {
  it("records a request for an unclaimed restaurant", async () => {
    const { repo, usecase } = build({ id: "r1", isActive: true, claimedAt: null });
    await usecase.execute("newa", dto);
    expect(repo.createClaimRequest).toHaveBeenCalledWith({ restaurantId: "r1", ...dto });
  });

  it("rejects a claimed restaurant", async () => {
    const { repo, usecase } = build({ id: "r1", isActive: true, claimedAt: new Date() });
    await expect(usecase.execute("newa", dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createClaimRequest).not.toHaveBeenCalled();
  });

  it("rejects an unknown restaurant", async () => {
    const { usecase } = build(null);
    await expect(usecase.execute("nope", dto)).rejects.toBeInstanceOf(NotFoundException);
  });
});
