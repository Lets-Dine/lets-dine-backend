import { buildAuthEntity } from "../../../../../common/testing";
import { fetchConsumptionSchema } from "../../../interfaces/http/validations/fetch-consumption.validation";
import { FetchConsumptionUsecase } from "../fetch-consumption.usecase";

const authUser = buildAuthEntity();

describe("FetchConsumptionUsecase", () => {
  it("should read the consumption feed for the branch in the token, never one from the request", async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 20, counts: { order: 0, manual: 0, waste: 0 } };
    const findConsumption = jest.fn().mockResolvedValue(page);
    const usecase = new FetchConsumptionUsecase({ findConsumption } as never);
    const query = fetchConsumptionSchema.parse({ source: "waste" });

    await expect(usecase.execute(query, authUser)).resolves.toBe(page);
    expect(findConsumption).toHaveBeenCalledWith(authUser.branchId, { page: 1, pageSize: 20, source: "waste" });
  });
});

describe("fetchConsumptionSchema", () => {
  it("should default to the first page of twenty and cap the page size", () => {
    expect(fetchConsumptionSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(fetchConsumptionSchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });

  it("should reject a period that ends before it starts, and an unknown source", () => {
    expect(fetchConsumptionSchema.safeParse({ from: "2026-11-10", to: "2026-11-01" }).success).toBe(false);
    expect(fetchConsumptionSchema.safeParse({ source: "stolen" }).success).toBe(false);
  });
});
