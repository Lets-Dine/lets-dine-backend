import { Test } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { FloorRepository } from "../../../domain/repositories/floor.repository";
import { CreateFloorUsecase } from "../create-floor.usecase";
import { FetchAllFloorsUsecase } from "../fetch-all-floors.usecase";
import { RegenerateFloorQrUsecase } from "../regenerate-floor-qr.usecase";
import { UpdateFloorUsecase } from "../update-floor.usecase";

const authUser = buildAuthEntity();
const floor = (overrides = {}) =>
  ({ id: "floor-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Ground", qrToken: "t", isActive: true, ...overrides }) as any;

describe("floor use cases — branch scoping", () => {
  let create: CreateFloorUsecase;
  let update: UpdateFloorUsecase;
  let regenerate: RegenerateFloorQrUsecase;
  let fetchAll: FetchAllFloorsUsecase;
  let repo: jest.Mocked<FloorRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateFloorUsecase,
        UpdateFloorUsecase,
        RegenerateFloorQrUsecase,
        FetchAllFloorsUsecase,
        { provide: FloorRepository, useValue: { findById: jest.fn(), findByName: jest.fn(), create: jest.fn(), update: jest.fn(), fetchAll: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    create = module.get(CreateFloorUsecase);
    update = module.get(UpdateFloorUsecase);
    regenerate = module.get(RegenerateFloorQrUsecase);
    fetchAll = module.get(FetchAllFloorsUsecase);
    repo = module.get(FloorRepository);
  });

  it("creates in the active branch and checks the name clash within that branch only", async () => {
    repo.findByName.mockResolvedValue(null);
    repo.create.mockResolvedValue(floor());
    await create.execute({ name: "Ground" }, authUser);
    expect(repo.findByName).toHaveBeenCalledWith(authUser.branchId, "Ground");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: authUser.restaurantId, branchId: authUser.branchId }),
      { actorId: authUser.sub }
    );
  });

  it("conflicts when the name is taken in this branch", async () => {
    repo.findByName.mockResolvedValue(floor());
    await expect(create.execute({ name: "Ground" }, authUser)).rejects.toBeInstanceOf(ConflictException);
  });

  it("lists only the active branch's floors", async () => {
    repo.fetchAll.mockResolvedValue({ rows: [], count: 0 });
    await fetchAll.execute({} as any, authUser);
    expect(repo.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: authUser.restaurantId, branchId: authUser.branchId }),
      expect.anything()
    );
  });

  it("404s update and QR rotation for a floor in another branch", async () => {
    repo.findById.mockResolvedValue(floor({ branchId: "other-branch" }));
    await expect(update.execute("floor-1", { isActive: false }, authUser)).rejects.toBeInstanceOf(NotFoundException);
    await expect(regenerate.execute("floor-1", authUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
