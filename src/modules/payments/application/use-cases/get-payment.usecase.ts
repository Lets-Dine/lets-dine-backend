import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";

@Injectable()
export class GetPaymentUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    const payment = await this.paymentRepository.findById(id, authEntity.restaurantId, authEntity.branchId);
    if (!payment) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.NOT_FOUND);
    return payment;
  }
}

/** Counts a print of the invoice. The first is the original; every later one is stamped "Copy of Original", so the count is IRD's reprint log. */
@Injectable()
export class RecordPaymentPrintUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<{ printCount: number }> {
    const printCount = await this.paymentRepository.recordPrint(id, authEntity.restaurantId, authEntity.branchId);
    if (printCount === null) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.NOT_FOUND);
    return { printCount };
  }
}
