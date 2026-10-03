import { Test } from "@nestjs/testing";
import { NotFoundException } from "../../../../common/exceptions";
import { BranchRepository } from "../../domain/repositories/branch.repository";
import { PublicBranchService } from "../public-branch.service";

const branch = { id: "b1", restaurantId: "r1", slug: "main", isActive: true } as any;

describe("PublicBranchService", () => {
  let service: PublicBranchService;
  let repo: jest.Mocked<BranchRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PublicBranchService, { provide: BranchRepository, useValue: { findById: jest.fn(), findBySlug: jest.fn(), findDefault: jest.fn() } }],
    }).compile();
    service = module.get(PublicBranchService);
    repo = module.get(BranchRepository);
  });

  it("returns null when no branch is named — the shared view", async () => {
    await expect(service.resolve("r1", {})).resolves.toBeNull();
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("resolves by id", async () => {
    repo.findById.mockResolvedValue(branch);
    await expect(service.resolve("r1", { branchId: "b1" })).resolves.toBe(branch);
  });

  it("resolves by slug within the restaurant", async () => {
    repo.findBySlug.mockResolvedValue(branch);
    await expect(service.resolve("r1", { branchSlug: "main" })).resolves.toBe(branch);
    expect(repo.findBySlug).toHaveBeenCalledWith("r1", "main");
  });

  it("404s a branch of another restaurant, an inactive one, and an unknown one alike", async () => {
    repo.findById.mockResolvedValueOnce({ ...branch, restaurantId: "other" });
    await expect(service.resolve("r1", { branchId: "b1" })).rejects.toBeInstanceOf(NotFoundException);
    repo.findById.mockResolvedValueOnce({ ...branch, isActive: false });
    await expect(service.resolve("r1", { branchId: "b1" })).rejects.toBeInstanceOf(NotFoundException);
    repo.findById.mockResolvedValueOnce(null);
    await expect(service.resolve("r1", { branchId: "b1" })).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("resolveOrDefault", () => {
    it("returns the named branch when there is one", async () => {
      repo.findBySlug.mockResolvedValue(branch);
      await expect(service.resolveOrDefault("r1", { branchSlug: "main" })).resolves.toBe(branch);
      expect(repo.findDefault).not.toHaveBeenCalled();
    });

    it("falls back to the restaurant's default branch when none is named", async () => {
      repo.findDefault.mockResolvedValue(branch);
      await expect(service.resolveOrDefault("r1", {})).resolves.toBe(branch);
    });

    it("404s when there is no usable default branch", async () => {
      repo.findDefault.mockResolvedValue({ ...branch, isActive: false });
      await expect(service.resolveOrDefault("r1", {})).rejects.toBeInstanceOf(NotFoundException);
      repo.findDefault.mockResolvedValue(null);
      await expect(service.resolveOrDefault("r1", {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
