import { NotFoundException } from "../../../../../common/exceptions";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { SetRestaurantClaimedUsecase } from "../set-restaurant-claimed.usecase";

function build(restaurant: object | null) {
  const repo = { findById: jest.fn().mockResolvedValue(restaurant), update: jest.fn().mockResolvedValue({}) };
  return { repo, usecase: new SetRestaurantClaimedUsecase(repo as unknown as RestaurantRepository) };
}

describe("SetRestaurantClaimedUsecase", () => {
  it("claims an unclaimed restaurant", async () => {
    const { repo, usecase } = build({ id: "r1", claimedAt: null });
    await usecase.execute("r1", true);
    expect(repo.update).toHaveBeenCalledWith("r1", { claimedAt: expect.any(Date) });
  });

  it("unclaims a claimed restaurant", async () => {
    const { repo, usecase } = build({ id: "r1", claimedAt: new Date() });
    await usecase.execute("r1", false);
    expect(repo.update).toHaveBeenCalledWith("r1", { claimedAt: null });
  });

  it("leaves an already-claimed restaurant untouched", async () => {
    const { repo, usecase } = build({ id: "r1", claimedAt: new Date() });
    await usecase.execute("r1", true);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("404s an unknown restaurant", async () => {
    await expect(build(null).usecase.execute("x", true)).rejects.toBeInstanceOf(NotFoundException);
  });
});
