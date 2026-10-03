import { Test } from "@nestjs/testing";
import { ForbiddenException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { DishReviewRepository } from "../../../domain/repositories/dish-review.repository";
import { FetchRestaurantReviewsUsecase } from "../fetch-restaurant-reviews.usecase";

describe("FetchRestaurantReviewsUsecase — branch scoping", () => {
  let usecase: FetchRestaurantReviewsUsecase;
  let repo: jest.Mocked<DishReviewRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FetchRestaurantReviewsUsecase, { provide: DishReviewRepository, useValue: { fetchAll: jest.fn() } }],
    }).compile();
    usecase = module.get(FetchRestaurantReviewsUsecase);
    repo = module.get(DishReviewRepository);
    repo.fetchAll.mockResolvedValue({ rows: [], count: 0 });
  });

  it("shows an owner every branch's reviews by default", async () => {
    await usecase.execute({} as any, buildAuthEntity());
    expect(repo.fetchAll.mock.calls[0][0].branchIds).toBeUndefined();
  });

  it("limits a manager to their assigned branches", async () => {
    await usecase.execute({} as any, buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a"] }));
    expect(repo.fetchAll.mock.calls[0][0].branchIds).toEqual(["branch-a"]);
  });

  it("narrows to one branch the caller can reach", async () => {
    await usecase.execute({ branchId: "branch-a" } as any, buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a", "branch-b"] }));
    expect(repo.fetchAll.mock.calls[0][0].branchIds).toEqual(["branch-a"]);
  });

  it("forbids a branch the caller is not assigned to", async () => {
    await expect(
      usecase.execute({ branchId: "branch-z" } as any, buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a"] }))
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.fetchAll).not.toHaveBeenCalled();
  });
});
