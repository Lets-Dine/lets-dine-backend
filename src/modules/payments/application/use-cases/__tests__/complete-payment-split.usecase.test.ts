import { Test } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConflictException, ForbiddenException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { CustomerRepository } from "../../../../customers/domain/repositories/customer.repository";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DiningSessionService } from "../../../../dining-sessions/application/dining-session.service";
import { DiningSessionRepository } from "../../../../dining-sessions/domain/repositories/dining-session.repository";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { LoyaltyService } from "../../../../loyalty/application/loyalty.service";
import { OrderRepository } from "../../../../orders/domain/repositories/order.repository";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { PaymentRepository } from "../../../domain/repositories/payment.repository";
import { CompletePaymentUsecase } from "../complete-payment.usecase";

const manager = buildAuthEntity({ role: StaffRole.MANAGER });
const tx = { $queryRaw: jest.fn() } as any;
const session = { id: "session-1", restaurantId: manager.restaurantId, branchId: manager.branchId, tableId: "table-1", endedAt: null };
const restaurant = { id: manager.restaurantId, serviceChargeRate: 0, taxRate: 0, currency: "NPR" };
// Two momo (200) and one tea (50) on the table.
const line = (id: string, name: string, unitPrice: number, quantity: number) => ({
  id,
  dishId: `dish-${id}`,
  dishNameSnapshot: name,
  unitPrice,
  quantity,
  status: "SERVED",
  addOns: [],
  variantNameSnapshot: null,
});
const order = {
  id: "order-1",
  status: "ACCEPTED",
  customerId: "customer-1",
  items: [line("momo", "Momo", 200, 2), line("tea", "Tea", 50, 1)],
};

describe("CompletePaymentUsecase — split by item", () => {
  let usecase: CompletePaymentUsecase;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let diningSessionService: jest.Mocked<DiningSessionService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CompletePaymentUsecase,
        {
          provide: PaymentRepository,
          useValue: {
            $transaction: jest.fn(fn => fn(tx)),
            create: jest.fn().mockResolvedValue({ id: "p" }),
            billedItems: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: DiningSessionRepository, useValue: { findById: jest.fn().mockResolvedValue(session) } },
        { provide: DiningSessionService, useValue: { endSession: jest.fn() } },
        { provide: DishRepository, useValue: { findManyByIds: jest.fn().mockResolvedValue([]) } },
        { provide: DishVariantRepository, useValue: { findById: jest.fn() } },
        { provide: AddOnRepository, useValue: { findManyByIds: jest.fn() } },
        {
          provide: OrderRepository,
          useValue: { findById: jest.fn(), findBySessionId: jest.fn().mockResolvedValue([order]), update: jest.fn() },
        },
        { provide: RestaurantRepository, useValue: { findByIdForBranch: jest.fn().mockResolvedValue(restaurant) } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LoyaltyService, useValue: { earnForPayment: jest.fn(), planRedemption: jest.fn(), recordRedemption: jest.fn() } },
        { provide: CustomerRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(CompletePaymentUsecase);
    paymentRepository = module.get(PaymentRepository);
    diningSessionService = module.get(DiningSessionService);
  });

  const pay = (split: { orderItemId: string; quantity: number }[], auth = manager, extra = {}) =>
    usecase.execute({ sessionId: "session-1", split, method: "CASH", endSession: true, ...extra }, auth);

  it("should bill the chosen lines at the order's own price and leave the table open while items remain", async () => {
    await pay([{ orderItemId: "momo", quantity: 1 }]);

    const [args] = paymentRepository.create.mock.calls[0];
    expect(args.items).toEqual([{ dishId: "dish-momo", orderItemId: "momo", dishNameSnapshot: "Momo", unitPrice: 200, quantity: 1 }]);
    expect(args.total).toBe(200);
    expect(diningSessionService.endSession).not.toHaveBeenCalled();
  });

  it("should end the session only with the share that bills the last item", async () => {
    paymentRepository.billedItems.mockResolvedValue([{ orderItemId: "momo", quantity: 1 }]);

    await pay([
      { orderItemId: "momo", quantity: 1 },
      { orderItemId: "tea", quantity: 1 },
    ]);

    expect(diningSessionService.endSession).toHaveBeenCalledTimes(1);
  });

  it("should refuse more of an item than is still unbilled, counting what earlier shares took", async () => {
    paymentRepository.billedItems.mockResolvedValue([{ orderItemId: "momo", quantity: 1 }]);

    await expect(pay([{ orderItemId: "momo", quantity: 2 }])).rejects.toBeInstanceOf(ConflictException);
    expect(paymentRepository.create).not.toHaveBeenCalled();
  });

  it("should refuse a whole-table bill once part of the table was billed by item", async () => {
    paymentRepository.billedItems.mockResolvedValue([{ orderItemId: "momo", quantity: 1 }]);

    await expect(
      usecase.execute({ sessionId: "session-1", items: [{ dishId: "dish-momo", addOnIds: [], quantity: 1 }], method: "CASH" }, manager)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("should refuse to split a table that already has a whole-table bill", async () => {
    paymentRepository.billedItems.mockResolvedValue([{ orderItemId: null, quantity: 3 }]);

    await expect(pay([{ orderItemId: "tea", quantity: 1 }])).rejects.toBeInstanceOf(ConflictException);
  });

  it("should not default the payer to the table's customer", async () => {
    await pay([{ orderItemId: "tea", quantity: 1 }]);

    expect(paymentRepository.create.mock.calls[0][0].customerId).toBeNull();
  });

  it("should refuse anyone but a manager or above", async () => {
    await expect(pay([{ orderItemId: "tea", quantity: 1 }], buildAuthEntity({ role: StaffRole.STAFF }))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
