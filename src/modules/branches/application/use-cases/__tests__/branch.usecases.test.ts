import { Test } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { EntitlementService } from "../../../../billing/application/entitlement.service";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { IBranchWithHours } from "../../../domain/interfaces/branch.interface";
import { BranchRepository } from "../../../domain/repositories/branch.repository";
import { CopyBranchMenuUsecase } from "../copy-branch-menu.usecase";
import { CreateBranchUsecase } from "../create-branch.usecase";
import { SetBranchHoursUsecase } from "../set-branch-hours.usecase";
import { FetchAllBranchesUsecase } from "../fetch-all-branches.usecase";
import { FetchBranchUsecase } from "../fetch-branch.usecase";
import { UpdateBranchUsecase } from "../update-branch.usecase";

const authUser = buildAuthEntity();

function buildBranch(overrides: Partial<IBranchWithHours> = {}): IBranchWithHours {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    restaurantId: authUser.restaurantId,
    name: "Main",
    slug: "main",
    address: "",
    phone: null,
    latitude: null,
    longitude: null,
    timezone: "Asia/Kathmandu",
    serviceChargeRate: null,
    taxRate: null,
    deliveryFeeAmount: null,
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    hours: [],
    ...overrides,
  };
}

describe("branch use cases", () => {
  let create: CreateBranchUsecase;
  let update: UpdateBranchUsecase;
  let setHours: SetBranchHoursUsecase;
  let fetchAll: FetchAllBranchesUsecase;
  let fetchOne: FetchBranchUsecase;
  let repo: jest.Mocked<BranchRepository>;
  let audit: jest.Mocked<AuditLogService>;
  let copyMenu: jest.Mocked<CopyBranchMenuUsecase>;
  let entitlements: jest.Mocked<EntitlementService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateBranchUsecase,
        UpdateBranchUsecase,
        SetBranchHoursUsecase,
        FetchAllBranchesUsecase,
        FetchBranchUsecase,
        {
          provide: BranchRepository,
          useValue: {
            findById: jest.fn(),
            findBySlug: jest.fn(),
            fetchAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            replaceHours: jest.fn(),
          },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: CopyBranchMenuUsecase, useValue: { execute: jest.fn() } },
        { provide: EntitlementService, useValue: { assertCanCreate: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    create = module.get(CreateBranchUsecase);
    update = module.get(UpdateBranchUsecase);
    setHours = module.get(SetBranchHoursUsecase);
    fetchAll = module.get(FetchAllBranchesUsecase);
    fetchOne = module.get(FetchBranchUsecase);
    repo = module.get(BranchRepository);
    audit = module.get(AuditLogService);
    copyMenu = module.get(CopyBranchMenuUsecase);
    entitlements = module.get(EntitlementService);
  });

  describe("create", () => {
    it("slugifies the name, scopes to the token's restaurant and audits", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(buildBranch({ name: "Lazimpat Branch", slug: "lazimpat-branch" }));

      await create.execute({ name: "Lazimpat Branch" }, authUser);

      expect(repo.create).toHaveBeenCalledWith(
        { name: "Lazimpat Branch", slug: "lazimpat-branch", restaurantId: authUser.restaurantId },
        { actorId: authUser.sub }
      );
      expect(audit.record).toHaveBeenCalledWith({ action: AuditAction.branch_created, subject: "Lazimpat Branch" }, authUser);
    });

    it("starts the new branch's menu as a copy when asked, and leaves it empty otherwise", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(buildBranch({ id: "new-branch" }));

      await create.execute({ name: "Lazimpat" }, authUser);
      expect(copyMenu.execute).not.toHaveBeenCalled();

      await create.execute({ name: "Lazimpat", copyMenuFrom: "source-branch" }, authUser);
      expect(copyMenu.execute).toHaveBeenCalledWith("new-branch", "source-branch", authUser);
      // `copyMenuFrom` is an instruction, not a column — it must never reach the repository.
      expect(repo.create.mock.calls[1][0]).not.toHaveProperty("copyMenuFrom");
    });

    it("rejects a name whose slug is taken", async () => {
      repo.findBySlug.mockResolvedValue(buildBranch());
      await expect(create.execute({ name: "Main" }, authUser)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("checks the plan's branch limit for the token's restaurant before creating anything", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(buildBranch());

      await create.execute({ name: "Lazimpat" }, authUser);

      expect(entitlements.assertCanCreate).toHaveBeenCalledWith("branch", authUser.restaurantId);
    });

    it("creates nothing once the plan's branch limit is reached", async () => {
      entitlements.assertCanCreate.mockRejectedValue(new ForbiddenException({ key: "PLAN_LIMIT_REACHED", message: "full" }));

      await expect(create.execute({ name: "Lazimpat" }, authUser)).rejects.toBeInstanceOf(ForbiddenException);

      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("holds re-enabling a disabled branch to the plan's branch limit", async () => {
      repo.findById.mockResolvedValue(buildBranch({ isActive: false }));
      entitlements.assertCanCreate.mockRejectedValue(new ForbiddenException({ key: "PLAN_LIMIT_REACHED", message: "full" }));

      await expect(update.execute("x", { isActive: true }, authUser)).rejects.toBeInstanceOf(ForbiddenException);

      expect(entitlements.assertCanCreate).toHaveBeenCalledWith("branch", authUser.restaurantId);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("does not count an edit to an already-active branch against the limit", async () => {
      repo.findById.mockResolvedValue(buildBranch());
      repo.update.mockResolvedValue(buildBranch({ name: "Renamed" }));

      await update.execute("x", { name: "Renamed", isActive: true }, authUser);

      expect(entitlements.assertCanCreate).not.toHaveBeenCalled();
    });

    it("404s for a branch of another restaurant", async () => {
      repo.findById.mockResolvedValue(buildBranch({ restaurantId: "other" }));
      await expect(update.execute("x", { name: "New" }, authUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to disable the default branch", async () => {
      repo.findById.mockResolvedValue(buildBranch({ isDefault: true }));
      await expect(update.execute("x", { isActive: false }, authUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("audits a disable", async () => {
      repo.findById.mockResolvedValue(buildBranch());
      repo.update.mockResolvedValue(buildBranch({ isActive: false }));
      await update.execute("x", { isActive: false }, authUser);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.branch_disabled }), authUser);
    });
  });

  describe("setHours", () => {
    it("rejects an open range that ends before it starts", async () => {
      repo.findById.mockResolvedValue(buildBranch());
      await expect(
        setHours.execute("x", { hours: [{ dayOfWeek: 1, opensAt: "18:00", closesAt: "09:00", isClosed: false }] }, authUser)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.replaceHours).not.toHaveBeenCalled();
    });

    it("replaces the schedule and audits", async () => {
      repo.findById.mockResolvedValue(buildBranch());
      repo.replaceHours.mockResolvedValue([]);
      const hours = [{ dayOfWeek: 1, opensAt: "09:00", closesAt: "21:00", isClosed: false }];
      await setHours.execute("x", { hours }, authUser);
      expect(repo.replaceHours).toHaveBeenCalledWith("x", hours);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.branch_hours_updated }), authUser);
    });
  });

  describe("branch scoping", () => {
    const manager = buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a"] });

    it("lists only the assigned branches for a non-owner", async () => {
      repo.fetchAll.mockResolvedValue({ rows: [], count: 0 });
      await fetchAll.execute({} as any, manager);
      expect(repo.fetchAll).toHaveBeenCalledWith(expect.objectContaining({ branchIds: ["branch-a"] }), expect.anything());
    });

    it("lists every branch for an owner", async () => {
      repo.fetchAll.mockResolvedValue({ rows: [], count: 0 });
      await fetchAll.execute({} as any, authUser);
      expect(repo.fetchAll).toHaveBeenCalledWith(expect.objectContaining({ branchIds: undefined }), expect.anything());
    });

    it("404s a branch the non-owner is not assigned to", async () => {
      repo.findById.mockResolvedValue(buildBranch({ id: "branch-b" }));
      await expect(fetchOne.execute("branch-b", manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns an assigned branch", async () => {
      repo.findById.mockResolvedValue(buildBranch({ id: "branch-a" }));
      await expect(fetchOne.execute("branch-a", manager)).resolves.toMatchObject({ id: "branch-a" });
    });
  });
});
