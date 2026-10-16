import { openingTenders } from "../../../payments/domain/utils/tender.util";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Injectable } from "@nestjs/common";
import {
  AuditAction,
  DeliverySettlementDirection,
  DeliverySettlementMethod,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from "@prisma/client";
import { can } from "../../../../common/auth/permissions";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../ledger/domain/repositories/ledger.repository";
import { LoyaltyService } from "../../../loyalty/application/loyalty.service";
import { IOrderWithItems } from "../../../orders/domain/interfaces/order.interface";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { PaymentRepository } from "../../../payments/domain/repositories/payment.repository";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { ledgerPostingsFor } from "../../domain/utils/delivery-ledger.util";
import { SettleDeliveryOrderInput } from "../../interfaces/http/validations/settle-delivery-order.validation";

/**
 * Settles a delivered order: the money side of a delivery, in one transaction.
 *
 *  - The sale is booked as the order's `Payment` — cash when the courier collected it at the door (or
 *    there was no courier), card when the order was already paid — so it is counted in the cash book
 *    like any other sale.
 *  - The cash the courier collected is received from them. That cash is the payment above, so it posts
 *    nothing further: counting it again as income would double it.
 *  - The courier's fee is paid now (an expense, posted to the cash book) or left owed. Leaving it
 *    owed is the point of `payFee: false`: it stays on the courier's account and is paid later from
 *    their page.
 *  - The order completes.
 *
 * Paying a fee takes money from the drawer, so it needs the cash book's `ledger:manage`; whoever works
 * the pass can still settle the order and leave the fee for a manager.
 */
@Injectable()
export class SettleDeliveryOrderUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly loyaltyService: LoyaltyService
  ) {}

  async execute(orderId: string, dto: SettleDeliveryOrderInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };

    const order = await this.orderRepository.findById(orderId);
    if (!order || !isInActiveBranch(authEntity, order)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.ORDER_NOT_FOUND);
    if (order.orderType !== OrderType.DELIVERY) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.NOT_A_DELIVERY_ORDER);
    if (order.status !== OrderStatus.SETTLE) throw new ConflictException(DELIVERY_ERROR_MESSAGES.ORDER_NOT_TO_SETTLE);

    const run = await this.deliveryRepository.findDeliveredAssignment(scope, orderId);
    const payFee = dto.payFee && run !== null && run.courierFee > 0;
    if (payFee && !can(authEntity.role, "ledger:manage")) throw new ForbiddenException(DELIVERY_ERROR_MESSAGES.FEE_NEEDS_MANAGER);

    // Cash when it was taken at the door or there is no courier to say otherwise; card when it was paid up front.
    const method = run && run.cashToCollect === 0 ? PaymentMethod.CARD : PaymentMethod.CASH;
    const courier = run ? (run.riderName ?? run.partnerName ?? "the courier") : null;

    const updated = await this.deliveryRepository.$transaction(async tx => {
      const now = new Date();
      const payment = await this.paymentRepository.create(
        {
          ...scope,
          sessionId: order.sessionId,
          tableId: null,
          customerId: order.customerId,
          subtotal: order.subtotal,
          serviceCharge: order.serviceCharge,
          tax: order.tax,
          discount: order.discount,
          total: order.total,
          ...openingTenders(order.total, method),
          method,
          currency: order.currency,
          createdBy: authEntity.sub,
          createdByName: authEntity.name,
          items: order.items
            .filter(item => item.status !== OrderItemStatus.CANCELLED)
            .map(item => ({
              dishId: item.dishId,
              dishNameSnapshot: item.dishNameSnapshot,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
            })),
        },
        { tx }
      );

      // Points commit with the bill they were earned on.
      await this.loyaltyService.earnForPayment({ ...payment, orderId: order.id }, tx);

      const completed = await this.orderRepository.update(
        order.id,
        { status: OrderStatus.COMPLETED, paidAt: now, completedAt: now },
        { tx, actorId: authEntity.sub }
      );

      if (run) {
        const note = `Order ${order.reference}`;
        const account = { accountKind: run.accountKind, accountId: run.accountId, orderId: order.id };
        const by = { createdBy: authEntity.sub, createdByName: authEntity.name };

        // The courier's cash for this order comes in. The payment above already counts it as a sale.
        if (run.cashCollected && run.cashCollected > 0) {
          await this.deliveryRepository.createSettlement(
            {
              ...scope,
              ...account,
              ...by,
              direction: DeliverySettlementDirection.COLLECT,
              amount: run.cashCollected,
              offset: 0,
              method: DeliverySettlementMethod.CASH,
              note,
            },
            { tx }
          );
        }

        if (payFee) {
          const fee = await this.deliveryRepository.createSettlement(
            {
              ...scope,
              ...account,
              ...by,
              direction: DeliverySettlementDirection.PAYOUT,
              amount: run.courierFee,
              offset: 0,
              method: dto.feeMethod,
              note,
            },
            { tx }
          );
          for (const posting of ledgerPostingsFor(fee)) {
            await this.ledgerRepository.createExpense(
              {
                ...scope,
                ...posting,
                note: `${courier} · ${note}`,
                createdBy: authEntity.sub,
                createdByName: authEntity.name,
                deliverySettlementId: fee.id,
              },
              { tx }
            );
          }
          await this.auditLogService.record(
            {
              action: AuditAction.delivery_settled,
              subject: courier ?? "Courier",
              detail: `Paid ${run.courierFee} for ${note} (${dto.feeMethod.toLowerCase()})`,
            },
            authEntity,
            tx
          );
        }
      }

      await this.auditLogService.record(
        {
          action: AuditAction.payment_completed,
          subject: `Order ${order.reference}`,
          detail: `Settled ${payment.total} ${payment.currency} via ${payment.method}${run ? ` — ${courier} ${payFee ? "paid" : "fee left owed"}` : ""}`,
        },
        authEntity,
        tx
      );
      await this.auditLogService.record(
        { action: AuditAction.order_status_changed, subject: `Order ${order.reference}`, detail: `${order.status} → ${completed.status}` },
        authEntity,
        tx
      );
      return completed;
    });

    this.eventEmitter.emit("order.updated", updated);
    return updated;
  }
}
