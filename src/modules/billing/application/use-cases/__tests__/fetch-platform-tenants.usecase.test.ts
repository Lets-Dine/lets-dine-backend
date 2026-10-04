import { Test } from "@nestjs/testing";
import { TenantRepository } from "../../../domain/repositories/tenant.repository";
import { FetchPlatformTenantsUsecase } from "../fetch-platform-tenants.usecase";

describe(FetchPlatformTenantsUsecase.name, () => {
  let usecase: FetchPlatformTenantsUsecase;
  const tenantRepository = { fetchAll: jest.fn(), countByView: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [FetchPlatformTenantsUsecase, { provide: TenantRepository, useValue: tenantRepository }],
    }).compile();
    usecase = module.get(FetchPlatformTenantsUsecase);
  });

  describe("execute", () => {
    it("should split the filters from the pagination and pass the page through unchanged", async () => {
      // Arrange
      const page = { rows: [], count: 42 };
      tenantRepository.fetchAll.mockResolvedValue(page);

      // Act
      const result = await usecase.execute({
        view: "trial",
        planKey: "growth",
        keyword: "momo",
        offset: 20,
        limit: 10,
        sortBy: "revenue",
        sortOrder: "desc",
        returnData: true,
        returnCount: true,
      });

      // Assert
      expect(tenantRepository.fetchAll).toHaveBeenCalledWith(
        { view: "trial", planKey: "growth", keyword: "momo" },
        { offset: 20, limit: 10, sortBy: "revenue", sortOrder: "desc", returnData: true, returnCount: true }
      );
      expect(result).toBe(page);
    });
  });
});
