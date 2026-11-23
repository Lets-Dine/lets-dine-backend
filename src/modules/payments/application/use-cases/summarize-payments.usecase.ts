import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IPaymentRegister, IPaymentsSummary } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";
import { PaymentRegisterQuery } from "../../interfaces/http/validations/payment-register.validation";
import { FetchPaymentsSummaryQuery } from "../../interfaces/http/validations/fetch-payments.validation";

/** Sold, collected, refunded and owed over every payment the filters match — not just the page on screen. */
@Injectable()
export class SummarizePaymentsUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  execute(query: FetchPaymentsSummaryQuery, authEntity: AuthEntity): Promise<IPaymentsSummary> {
    return this.paymentRepository.summarize({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, ...query });
  }
}

/** The sales and sales-return registers for one fiscal year — what the restaurant's books and VAT return are filled from. */
@Injectable()
export class PaymentRegisterUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  execute(query: PaymentRegisterQuery, authEntity: AuthEntity): Promise<IPaymentRegister> {
    return this.paymentRepository.register(authEntity.restaurantId, query.fiscalYear);
  }
}
