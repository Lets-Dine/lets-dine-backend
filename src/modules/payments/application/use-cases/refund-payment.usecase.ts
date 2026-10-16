import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { isUniqueViolation } from "../../domain/utils/unique-violation.util";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";
import { RefundPaymentInput } from "../../interfaces/http/validations/collect-payment.validation";

/**
 * Hands money back against a sale. The payment and its collections stay as they were; the refund is its own
 * record and its own cash-book outflow, so the history reads: sold, collected, refunded.
 */
@Injectable()
export class RefundPaymentUsecase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(paymentId: string, dto: RefundPaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    try {
      return await this.attempt(paymentId, dto, authEntity);
    } catch (error) {
      if (isUniqueViolation(error)) return this.attempt(paymentId, dto, authEntity);
      throw error;
    }
  }

  private async attempt(paymentId: string, dto: RefundPaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    const { restaurantId, branchId } = authEntity;
    return this.paymentRepository.$transaction(async tx => {
      const existing = await this.paymentRepository.findById(paymentId, restaurantId, branchId, { tx });
      if (!existing) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.NOT_FOUND);
      if (dto.tenderId) {
        const tender = existing.tenders.find(t => t.id === dto.tenderId);
        if (!tender) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.TENDER_NOT_FOUND);
        // A refund pointing at a collection must fit it: money actually taken, by that method, and no more than it took.
        if (tender.status !== "SUCCEEDED" || tender.method !== dto.method || dto.amount > tender.amount) {
          throw new ConflictException(PAYMENT_ERROR_MESSAGES.TENDER_NOT_REFUNDABLE);
        }
      }

      const prior = await this.paymentRepository.findRefundByKey(restaurantId, dto.idempotencyKey, { tx });
      if (prior) {
        if (prior.paymentId !== paymentId) throw new ConflictException(PAYMENT_ERROR_MESSAGES.KEY_REUSED);
        return existing;
      }

      const refund = await this.paymentRepository.addRefund(
        paymentId,
        { restaurantId, branchId, createdBy: authEntity.sub, createdByName: authEntity.name },
        { amount: dto.amount, method: dto.method, tenderId: dto.tenderId, reason: dto.reason, idempotencyKey: dto.idempotencyKey },
        { tx }
      );
      if (!refund) throw new ConflictException(PAYMENT_ERROR_MESSAGES.OVER_REFUND);

      await this.auditLogService.record(
        {
          action: AuditAction.payment_refunded,
          subject: `Payment ${paymentId}`,
          detail: `Refunded ${dto.amount} ${existing.currency} via ${dto.method}${dto.reason ? ` — ${dto.reason}` : ""}`,
        },
        authEntity,
        tx
      );
      return (await this.paymentRepository.findById(paymentId, restaurantId, branchId, { tx })) as IPaymentWithItems;
    });
  }
}
