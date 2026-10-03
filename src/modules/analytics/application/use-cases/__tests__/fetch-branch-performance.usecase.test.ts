import { Test } from "@nestjs/testing";
import { BadRequestException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchBranchPerformanceUsecase } from "../fetch-branch-performance.usecase";

describe("FetchBranchPerformanceUsecase", () => {
  let usecase: FetchBranchPerformanceUsecase;
  let repo: jest.Mocked<AnalyticsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FetchBranchPerformanceUsecase, { provide: AnalyticsRepository, useValue: { fetchBranchPerformance: jest.fn() } }],
    }).compile();
    usecase = module.get(FetchBranchPerformanceUsecase);
    repo = module.get(AnalyticsRepository);
    repo.fetchBranchPerformance.mockResolvedValue([]);
  });

  it("covers every branch for an owner, over the trailing 30 days by default", async () => {
    const owner = buildAuthEntity();
    await usecase.execute({}, owner);
    const [scope, range] = repo.fetchBranchPerformance.mock.calls[0];
    expect(scope).toEqual({ restaurantId: owner.restaurantId, branchIds: undefined });
    expect(range.to.getTime() - range.from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("shows a manager only their own branches", async () => {
    const manager = buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a"] });
    await usecase.execute({}, manager);
    expect(repo.fetchBranchPerformance.mock.calls[0][0]).toEqual({ restaurantId: manager.restaurantId, branchIds: ["branch-a"] });
  });

  it("rejects a range that ends before it starts", async () => {
    await expect(usecase.execute({ from: new Date("2026-02-01"), to: new Date("2026-01-01") }, buildAuthEntity())).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
