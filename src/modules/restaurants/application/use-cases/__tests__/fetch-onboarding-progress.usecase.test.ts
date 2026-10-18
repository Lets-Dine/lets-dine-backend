import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { IRestaurant } from "../../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { FetchOnboardingProgressUsecase } from "../fetch-onboarding-progress.usecase";

const authUser = buildAuthEntity();
const restaurant = { id: authUser.restaurantId, logoUrl: null, taxRate: 0, serviceChargeRate: 0 } as IRestaurant;
const empty = { categories: 0, dishes: 0, tables: 0, activeMembers: 1, orders: 0 };

describe(FetchOnboardingProgressUsecase.name, () => {
  let usecase: FetchOnboardingProgressUsecase;
  let repo: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchOnboardingProgressUsecase,
        { provide: RestaurantRepository, useValue: { findByIdForBranch: jest.fn(), countSetupSignals: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(FetchOnboardingProgressUsecase);
    repo = module.get(RestaurantRepository);
  });

  describe("execute", () => {
    it("should report nothing done for a freshly registered restaurant", async () => {
      // Arrange
      repo.findByIdForBranch.mockResolvedValue(restaurant);
      repo.countSetupSignals.mockResolvedValue(empty);
      // Act
      const result = await usecase.execute(authUser);
      // Assert
      expect(result.completed).toBe(0);
      expect(result.total).toBe(7);
      expect(repo.countSetupSignals).toHaveBeenCalledWith(authUser.restaurantId, authUser.branchId);
    });

    it("should tick steps whose data exists", async () => {
      // Arrange
      repo.findByIdForBranch.mockResolvedValue({ ...restaurant, logoUrl: "x.png", taxRate: 0.13 });
      repo.countSetupSignals.mockResolvedValue({ categories: 2, dishes: 5, tables: 4, activeMembers: 3, orders: 1 });
      // Act
      const result = await usecase.execute(authUser);
      // Assert
      expect(result.completed).toBe(7);
      expect(result.steps.every(s => s.done)).toBe(true);
    });

    it("should not count the owner alone as invited staff", async () => {
      // Arrange
      repo.findByIdForBranch.mockResolvedValue(restaurant);
      repo.countSetupSignals.mockResolvedValue(empty);
      // Act
      const result = await usecase.execute(authUser);
      // Assert
      expect(result.steps.find(s => s.key === "staff")?.done).toBe(false);
    });

    it("should throw when the restaurant does not exist", async () => {
      // Arrange
      repo.findByIdForBranch.mockResolvedValue(null);
      repo.countSetupSignals.mockResolvedValue(empty);
      // Act & Assert
      await expect(usecase.execute(authUser)).rejects.toThrow(NotFoundException);
    });
  });
});
