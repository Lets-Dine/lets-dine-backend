import { Test } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { ForbiddenException, UnauthorizedException } from "../../../../common/exceptions";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { IStaffMember } from "../../../users/domain/interfaces/restaurant-member.interface";
import { BranchScopeService } from "../branch-scope.service";

const member = (role: StaffRole): IStaffMember =>
  ({ id: "member-1", userId: "user-1", restaurantId: "restaurant-1", role, isActive: true, name: "A", email: "a@b.c" }) as IStaffMember;

const main = { id: "branch-main", isDefault: true } as any;
const other = { id: "branch-other", isDefault: false } as any;

describe("BranchScopeService", () => {
  let service: BranchScopeService;
  let repo: jest.Mocked<BranchRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BranchScopeService, { provide: BranchRepository, useValue: { findAccessible: jest.fn() } }],
    }).compile();
    service = module.get(BranchScopeService);
    repo = module.get(BranchRepository);
  });

  it("starts an OWNER in the default branch and grants every branch", async () => {
    repo.findAccessible.mockResolvedValue([main, other]);
    const result = await service.resolve(member(StaffRole.OWNER));
    expect(result.active).toBe(main);
    expect(result.branchIds).toBe("all");
  });

  it("limits a MANAGER to their assigned branches", async () => {
    repo.findAccessible.mockResolvedValue([other]);
    const result = await service.resolve(member(StaffRole.MANAGER));
    expect(result.active).toBe(other);
    expect(result.branchIds).toEqual(["branch-other"]);
  });

  it("switches to a requested branch the member can reach", async () => {
    repo.findAccessible.mockResolvedValue([main, other]);
    const result = await service.resolve(member(StaffRole.STAFF), "branch-other");
    expect(result.active).toBe(other);
  });

  it("forbids a branch outside the member's access", async () => {
    repo.findAccessible.mockResolvedValue([main]);
    await expect(service.resolve(member(StaffRole.STAFF), "branch-other")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a member with no active branch", async () => {
    repo.findAccessible.mockResolvedValue([]);
    await expect(service.resolve(member(StaffRole.STAFF))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
