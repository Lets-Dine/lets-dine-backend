import { Injectable } from "@nestjs/common";
import { AuditAction, OrderItemStatus, OrderStatus, OrderType, PaymentMethod } from "@prisma/client";
import { AuthEntity } from "../../../common/interfaces";
import { PrismaTransaction } from "../../../common/prisma";
import { AuditLogService } from "../../audit-logs/application/audit-log.service";
import { LoyaltyService } from "../../loyalty/application/loyalty.service";
import { IOrderWithItems } from "../../orders/domain/interfaces/order.interface";
import { OrderRepository } from "../../orders/domain/repositories/order.repository";
import { PaymentRepository } from "../../payments/domain/repositories/payment.repository";
import { openingTenders } from "../../payments/domain/utils/tender.util";
import { DeliveryRepository } from "../domain/repositories/delivery.repository";

/** Emitted by the order status change that sends a delivery out; `DispatchPaymentListener` opens the bill. */
export const ORDER_DISPATCHED = "order.dispatched";

/** The retry key of a delivery's bill: the bill opened at dispatch and the settlement both find it by this. */
export const dispatchKey = (orderId: string) => `delivery-dispatch:${orderId}`;

/** A delivery order's bill as it stands now. Callers add the method, the collections and the key. */
export function billOf(order: IOrderWithItems, by: Pick<AuthEntity, "sub" | "name">) {
  return {
    restaurantId: order.restaurantId,
    branchId: order.branchId,
    sessionId: order.sessionId,
    tableId: null,
    customerId: order.customerId,
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
    createdBy: by.sub,
    createdByName: by.name,
    items: order.items
      .filter(item => item.status !== OrderItemStatus.CANCELLED)
      .map(item => ({
        dishId: item.dishId,
        dishNameSnapshot: item.dishNameSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
  };
}

@Injectable()
export class DeliveryPaymentService {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly loyaltyService: LoyaltyService,
    private readonly auditLogService: AuditLogService
  ) {}

  /**
   * Cash on delivery: the bill opens when the order leaves, UNPAID, and the courier's cash is collected against it at
   * settlement. Only for a run that is to collect cash, and only once per order. A no-op for anything else.
   */
  async openForDispatch(orderId: string, actor: AuthEntity, tx: PrismaTransaction): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.orderType !== OrderType.DELIVERY || order.status !== OrderStatus.OUT_FOR_DELIVERY) return;

    const scope = { restaurantId: order.restaurantId, branchId: order.branchId };
    const run = await this.deliveryRepository.findOpenAssignment(scope, orderId, { tx });
    if (!run || run.cashToCollect <= 0) return;
    if (await this.paymentRepository.findByIdempotencyKey(scope.restaurantId, dispatchKey(orderId), { tx })) return;

    const payment = await this.paymentRepository.create(
      {
        ...billOf(order, actor),
        ...openingTenders(order.total, PaymentMethod.CASH, []),
        method: PaymentMethod.CASH,
        idempotencyKey: dispatchKey(orderId),
      },
      { tx }
    );
    // Points are earned on what the bill is worth, so they come with it at dispatch, not with the cash.
    await this.loyaltyService.earnForPayment({ ...payment, orderId }, tx);
    await this.auditLogService.record(
      {
        action: AuditAction.payment_completed,
        subject: `Order ${order.reference}`,
        detail: `Bill opened for delivery: ${order.total} ${order.currency} to collect at the door (${run.riderName ?? run.partnerName ?? "courier"})`,
      },
      actor,
      tx
    );
  }
}
