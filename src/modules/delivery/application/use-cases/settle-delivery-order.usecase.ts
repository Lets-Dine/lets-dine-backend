import { PAYMENT_ERROR_MESSAGES } from "../../../payments/domain/constants";
import { openingTenders } from "../../../payments/domain/utils/tender.util";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Injectable } from "@nestjs/common";
import { AuditAction, DeliverySettlementDirection, DeliverySettlementMethod, OrderStatus, OrderType, PaymentMethod } from "@prisma/client";
import { can } from "../../../../common/auth/permissions";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../ledger/domain/repositories/ledger.repository";
import { LoyaltyService } from "../../../loyalty/application/loyalty.service";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { IOrderWithItems } from "../../../orders/domain/interfaces/order.interface";
import { PaymentRepository } from "../../../payments/domain/repositories/payment.repository";
import { IPaymentWithItems } from "../../../payments/domain/interfaces/payment.interface";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { ledgerPostingsFor } from "../../domain/utils/delivery-ledger.util";
import { SettleDeliveryOrderInput } from "../../interfaces/http/validations/settle-delivery-order.validation";
import { billOf, dispatchKey } from "../delivery-payment.service";

/**
 * Settles a delivered order: the money side of a delivery, in one transaction.
 *
 *  - The sale is booked as the order's `Payment` — cash when the courier collected it at the door (or
 *    there was no courier), card when the order was already paid — so it is counted in the cash book
 *    like any other sale. A cash-on-delivery bill was already opened when the order went out
 *    (`DeliveryPaymentService`); the cash the courier brings back is added to that bill as its collection.
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
    // Only what the courier actually handed over is paid. A short hand-over leaves the rest owed by the customer, the
    // way a part-paid bill at the till does — never booked as fully collected.
    const collected = method === PaymentMethod.CASH && run ? Math.min(Math.max(run.cashCollected ?? 0, 0), order.total) : order.total;
    const tenders = collected === order.total ? undefined : collected > 0 ? [{ method, amount: collected }] : [];
    if (collected < order.total && !order.customerId) throw new BadRequestException(PAYMENT_ERROR_MESSAGES.CREDIT_NEEDS_CUSTOMER);
    const courier = run ? (run.riderName ?? run.partnerName ?? "the courier") : null;

    const updated = await this.deliveryRepository.$transaction(async tx => {
      const now = new Date();
      // A cash-on-delivery bill was opened when the order went out, so the courier's cash is collected against it. Otherwise
      // (paid up front, or a dispatch that never opened one) the bill is booked here, as it always was.
      const opened = await this.paymentRepository.findByIdempotencyKey(scope.restaurantId, dispatchKey(order.id), { tx });
      let payment: IPaymentWithItems;
      if (opened) {
        if (collected > 0) {
          const tender = await this.paymentRepository.addTender(
            opened.id,
            { ...scope, createdBy: authEntity.sub, createdByName: authEntity.name },
            { amount: collected, method },
            { tx }
          );
          if (!tender) throw new ConflictException(PAYMENT_ERROR_MESSAGES.OVER_OWED);
        }
        payment = (await this.paymentRepository.findById(opened.id, scope.restaurantId, scope.branchId, { tx })) ?? opened;
      } else {
        payment = await this.paymentRepository.create(
          {
            ...billOf(order, authEntity),
            ...openingTenders(order.total, method, tenders),
            method,
          },
          { tx }
        );
        // Points commit with the bill they were earned on (a part-paid bill earns on what it was charged, as at the till).
        await this.loyaltyService.earnForPayment({ ...payment, orderId: order.id }, tx);
      }

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
          detail: `Settled ${payment.total} ${payment.currency} via ${payment.method}${payment.paymentStatus === "PAID" ? "" : ` (${payment.paymentStatus}, ${payment.total - payment.paidAmount} owed)`}${run ? ` — ${courier} ${payFee ? "paid" : "fee left owed"}` : ""}`,
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
