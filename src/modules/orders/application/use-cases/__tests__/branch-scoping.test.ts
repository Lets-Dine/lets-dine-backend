import { Test } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { FetchAllOrdersUsecase } from "../fetch-all-orders.usecase";
import { FetchOrderByIdUsecase } from "../fetch-order-by-id.usecase";

const authUser = buildAuthEntity();

describe("order use cases — branch scoping", () => {
  let fetchById: FetchOrderByIdUsecase;
  let fetchAll: FetchAllOrdersUsecase;
  let repo: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FetchOrderByIdUsecase,
        FetchAllOrdersUsecase,
        { provide: OrderRepository, useValue: { findById: jest.fn(), fetchAll: jest.fn() } },
      ],
    }).compile();
    fetchById = module.get(FetchOrderByIdUsecase);
    fetchAll = module.get(FetchAllOrdersUsecase);
    repo = module.get(OrderRepository);
  });

  it("returns an order of the active branch", async () => {
    repo.findById.mockResolvedValue({ id: "o", restaurantId: authUser.restaurantId, branchId: authUser.branchId } as any);
    await expect(fetchById.execute("o", authUser)).resolves.toMatchObject({ id: "o" });
  });

  it("404s an order of another branch of the same restaurant", async () => {
    repo.findById.mockResolvedValue({ id: "o", restaurantId: authUser.restaurantId, branchId: "other-branch" } as any);
    await expect(fetchById.execute("o", authUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists only the active branch's orders", async () => {
    repo.fetchAll.mockResolvedValue({ rows: [], count: 0 });
    await fetchAll.execute({} as any, authUser);
    expect(repo.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: authUser.restaurantId, branchId: authUser.branchId }),
      expect.anything()
    );
  });
});
