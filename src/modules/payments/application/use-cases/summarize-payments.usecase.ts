import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IPaymentsSummary } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";
import { FetchPaymentsSummaryQuery } from "../../interfaces/http/validations/fetch-payments.validation";

/** Sold, collected, refunded and owed over every payment the filters match — not just the page on screen. */
@Injectable()
export class SummarizePaymentsUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  execute(query: FetchPaymentsSummaryQuery, authEntity: AuthEntity): Promise<IPaymentsSummary> {
    return this.paymentRepository.summarize({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, ...query });
  }
}
