import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { SuppliersRepository } from "../../../domain/repositories/suppliers.repository";
import { RecordSupplierPaymentUsecase } from "../record-supplier-payment.usecase";

const authUser = buildAuthEntity();
const input = (over = {}) => ({ supplier: "ram traders", amount: 3000, method: "CASH" as const, note: "", ...over });
const stats = (credit: number) => new Map([["ram traders", { name: "Ram Traders", deliveries: 2, spent: 9000, credit, lastDeliveryAt: null }]]);

describe("RecordSupplierPaymentUsecase", () => {
  let usecase: RecordSupplierPaymentUsecase;
  let repo: jest.Mocked<SuppliersRepository>;

  const setup = async (credit: number, paid: number, saved: unknown = null) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordSupplierPaymentUsecase,
        {
          provide: SuppliersRepository,
          useValue: {
            findSupplierByName: jest.fn().mockResolvedValue(saved),
            findDeliveryStats: jest.fn().mockResolvedValue(stats(credit)),
            findPaidTotals: jest.fn().mockResolvedValue(new Map(paid ? [["ram traders", paid]] : [])),
            createPayment: jest.fn().mockResolvedValue({ id: "p1" }),
          },
        },
      ],
    }).compile();
    usecase = module.get(RecordSupplierPaymentUsecase);
    repo = module.get(SuppliersRepository);
  };

  it("books a payment up to what is owed, under the name on the deliveries", async () => {
    await setup(5000, 2000);
    await usecase.execute(input({ amount: 3000 }), authUser);
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ supplier: "Ram Traders", amount: 3000 }));
  });

  it("refuses more than is owed", async () => {
    await setup(5000, 2000);
    await expect(usecase.execute(input({ amount: 3001 }), authUser)).rejects.toThrow(BadRequestException);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it("refuses a supplier it has never seen", async () => {
    await setup(0, 0);
    repo.findDeliveryStats.mockResolvedValue(new Map());
    await expect(usecase.execute(input(), authUser)).rejects.toThrow(NotFoundException);
  });
});
