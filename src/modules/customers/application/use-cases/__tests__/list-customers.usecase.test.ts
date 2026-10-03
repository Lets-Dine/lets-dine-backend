import { CustomerRepository } from "../../../domain/repositories/customer.repository";
import { ListCustomersUsecase } from "../list-customers.usecase";

describe("ListCustomersUsecase", () => {
  it("should scope the list to the caller's restaurant and branch, whatever the query says", async () => {
    const customerRepository = { fetchAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }) } as unknown as jest.Mocked<CustomerRepository>;
    const usecase = new ListCustomersUsecase(customerRepository);

    await usecase.execute(
      { q: "anita", segment: "regular", sortBy: "spend", sortOrder: "desc", limit: 20, offset: 40, returnData: true, returnCount: true },
      { restaurantId: "restaurant-1", branchId: "branch-1" } as any
    );

    expect(customerRepository.fetchAll).toHaveBeenCalledWith(
      { restaurantId: "restaurant-1", branchId: "branch-1", q: "anita", segment: "regular" },
      { sortBy: "spend", sortOrder: "desc", limit: 20, offset: 40, returnData: true }
    );
  });
});
