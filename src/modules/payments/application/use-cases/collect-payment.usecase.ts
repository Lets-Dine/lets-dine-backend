import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { isUniqueViolation } from "../../domain/utils/unique-violation.util";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";
import { CollectPaymentInput } from "../../interfaces/http/validations/collect-payment.validation";

/**
 * Takes money against a bill that is not fully paid — the second half of a split, or a credit sale being
 * settled. Adds a collection only: the sale is never created again, so revenue is not counted twice, and
 * the cash book hears of the money through the new collection alone.
 */
@Injectable()
export class CollectPaymentUsecase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(paymentId: string, dto: CollectPaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    try {
      return await this.attempt(paymentId, dto, authEntity);
    } catch (error) {
      // Two identical requests raced and the other one landed: run again, and the key now finds its collection.
      if (isUniqueViolation(error)) return this.attempt(paymentId, dto, authEntity);
      throw error;
    }
  }

  private async attempt(paymentId: string, dto: CollectPaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    const { restaurantId, branchId } = authEntity;
    return this.paymentRepository.$transaction(async tx => {
      const existing = await this.paymentRepository.findById(paymentId, restaurantId, branchId, { tx });
      if (!existing) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.NOT_FOUND);

      // Replay of the same request: hand back the bill as it stands, collect nothing more.
      const prior = await this.paymentRepository.findTenderByKey(restaurantId, dto.idempotencyKey, { tx });
      if (prior) {
        // A key belongs to one collection on one bill; reusing it elsewhere is a client bug, not a replay.
        if (prior.paymentId !== paymentId) throw new ConflictException(PAYMENT_ERROR_MESSAGES.KEY_REUSED);
        return existing;
      }

      const tender = await this.paymentRepository.addTender(
        paymentId,
        { restaurantId, branchId, createdBy: authEntity.sub, createdByName: authEntity.name },
        { amount: dto.amount, method: dto.method, reference: dto.reference, idempotencyKey: dto.idempotencyKey },
        { tx }
      );
      if (!tender) throw new ConflictException(PAYMENT_ERROR_MESSAGES.OVER_OWED);

      await this.auditLogService.record(
        {
          action: AuditAction.payment_collected,
          subject: `Payment ${paymentId}`,
          detail: `Collected ${dto.amount} ${existing.currency} via ${dto.method}`,
        },
        authEntity,
        tx
      );
      return (await this.paymentRepository.findById(paymentId, restaurantId, branchId, { tx })) as IPaymentWithItems;
    });
  }
}
