import { CustomerRepository } from "../../../domain/repositories/customer.repository";
import { CreateCustomerUsecase } from "../create-customer.usecase";

const auth = { restaurantId: "restaurant-1" } as any;

describe("CreateCustomerUsecase", () => {
  it("saves a new customer under the caller's restaurant", async () => {
    const saved = { id: "c1", name: "Anita", phone: "9800000000" };
    const repo = { findByPhone: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue(saved) } as unknown as jest.Mocked<CustomerRepository>;

    const result = await new CreateCustomerUsecase(repo).execute({ name: "Anita", phone: "9800000000" }, auth);

    expect(repo.upsert).toHaveBeenCalledWith({ restaurantId: "restaurant-1", phone: "9800000000", name: "Anita" });
    expect(result).toBe(saved);
  });

  it("gives back a customer already on file, without renaming them", async () => {
    const known = { id: "c1", name: "Anita Sharma", phone: "9800000000" };
    const repo = { findByPhone: jest.fn().mockResolvedValue(known), upsert: jest.fn() } as unknown as jest.Mocked<CustomerRepository>;

    const result = await new CreateCustomerUsecase(repo).execute({ name: "Someone else", phone: "9800000000" }, auth);

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(result).toBe(known);
  });
});
