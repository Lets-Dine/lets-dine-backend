import { Test } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { BranchMenuRepository } from "../../../domain/repositories/branch-menu.repository";
import { BranchRepository } from "../../../domain/repositories/branch.repository";
import { CopyBranchMenuUsecase } from "../copy-branch-menu.usecase";

const owner = buildAuthEntity();
const from = { id: "from", restaurantId: owner.restaurantId, name: "Main" } as any;
const to = { id: "to", restaurantId: owner.restaurantId, name: "Lazimpat" } as any;
const copied = { categories: 2, dishes: 9, variants: 3, addOns: 4 };

describe("CopyBranchMenuUsecase", () => {
  let usecase: CopyBranchMenuUsecase;
  let branches: jest.Mocked<BranchRepository>;
  let menus: jest.Mocked<BranchMenuRepository>;
  let audit: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CopyBranchMenuUsecase,
        { provide: BranchRepository, useValue: { findById: jest.fn() } },
        {
          provide: BranchMenuRepository,
          useValue: { isMenuEmpty: jest.fn().mockResolvedValue(true), copyMenu: jest.fn().mockResolvedValue(copied) },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(CopyBranchMenuUsecase);
    branches = module.get(BranchRepository);
    menus = module.get(BranchMenuRepository);
    audit = module.get(AuditLogService);
    branches.findById.mockImplementation(async id => (id === "from" ? from : id === "to" ? to : null));
  });

  it("copies one branch's menu into an empty one and audits what moved", async () => {
    await expect(usecase.execute("to", "from", owner)).resolves.toEqual(copied);
    expect(menus.copyMenu).toHaveBeenCalledWith("from", "to", owner.sub);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.branch_updated,
        subject: "Lazimpat",
        detail: expect.stringContaining("copied from Main"),
      }),
      owner
    );
  });

  it("refuses to copy a branch onto itself", async () => {
    await expect(usecase.execute("to", "to", owner)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to copy over a menu that already has content, rather than merging two menus", async () => {
    menus.isMenuEmpty.mockResolvedValue(false);
    await expect(usecase.execute("to", "from", owner)).rejects.toBeInstanceOf(ConflictException);
    expect(menus.copyMenu).not.toHaveBeenCalled();
  });

  it("404s a branch of another restaurant on either side, and an unknown one", async () => {
    branches.findById.mockImplementation(async id => (id === "from" ? { ...from, restaurantId: "other" } : to));
    await expect(usecase.execute("to", "from", owner)).rejects.toBeInstanceOf(NotFoundException);
    branches.findById.mockImplementation(async id => (id === "to" ? { ...to, restaurantId: "other" } : from));
    await expect(usecase.execute("to", "from", owner)).rejects.toBeInstanceOf(NotFoundException);
    branches.findById.mockResolvedValue(null);
    await expect(usecase.execute("to", "from", owner)).rejects.toBeInstanceOf(NotFoundException);
    expect(menus.copyMenu).not.toHaveBeenCalled();
  });
});
