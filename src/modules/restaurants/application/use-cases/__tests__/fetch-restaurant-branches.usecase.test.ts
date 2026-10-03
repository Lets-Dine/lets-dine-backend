import { Test } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { BranchRepository } from "../../../../branches/domain/repositories/branch.repository";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { FetchRestaurantBranchesUsecase } from "../fetch-restaurant-branches.usecase";

const branch = {
  id: "b1", name: "Main", slug: "main", address: "Thamel", phone: null, latitude: null, longitude: null,
  timezone: "Asia/Kathmandu", isDefault: true, isActive: true, taxRate: 0.9, serviceChargeRate: 0.9, deliveryFeeAmount: 500, hours: [],
} as any;

describe("FetchRestaurantBranchesUsecase", () => {
  let usecase: FetchRestaurantBranchesUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let branchRepository: jest.Mocked<BranchRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FetchRestaurantBranchesUsecase,
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: BranchRepository, useValue: { findActiveWithHours: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(FetchRestaurantBranchesUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    branchRepository = module.get(BranchRepository);
  });

  it("lists the restaurant's active branches in their public shape", async () => {
    restaurantRepository.findBySlug.mockResolvedValue({ id: "r1", isActive: true } as any);
    branchRepository.findActiveWithHours.mockResolvedValue([branch]);

    const result = await usecase.execute("newa-kitchen");

    expect(branchRepository.findActiveWithHours).toHaveBeenCalledWith("r1");
    expect(result).toEqual([expect.objectContaining({ id: "b1", slug: "main", isOpenNow: true })]);
    expect(result[0]).not.toHaveProperty("taxRate");
    expect(result[0]).not.toHaveProperty("deliveryFeeAmount");
  });

  it("404s an unknown or deactivated restaurant", async () => {
    restaurantRepository.findBySlug.mockResolvedValue({ id: "r1", isActive: false } as any);
    await expect(usecase.execute("x")).rejects.toBeInstanceOf(NotFoundException);
    expect(branchRepository.findActiveWithHours).not.toHaveBeenCalled();
  });
});
