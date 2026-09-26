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
    const payment = await this.paymentRepository.findById(id, authEntity.restaurantId);
    if (!payment) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.NOT_FOUND);
    return payment;
  }
}
