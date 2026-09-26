import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";
import { FetchPaymentsQuery } from "../../interfaces/http/validations/fetch-payments.validation";

@Injectable()
export class ListPaymentsUsecase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute(query: FetchPaymentsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IPaymentWithItems>> {
    const { tableId, from, to, ...pagination } = query;

    return this.paymentRepository.fetchAll({ restaurantId: authEntity.restaurantId, tableId, from, to }, pagination);
  }
}
