import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { DEFAULT_LOYALTY_PROGRAM, LOYALTY_ERROR_MESSAGES } from "../../domain/constants";
import { ICustomerLoyalty } from "../../domain/interfaces/loyalty.interface";
import { LoyaltyRepository } from "../../domain/repositories/loyalty.repository";
import { CustomerLoyaltyQueryDto } from "../dto/loyalty.dto";

@Injectable()
export class GetCustomerLoyaltyUsecase {
  constructor(private readonly loyaltyRepository: LoyaltyRepository) {}

  async execute(customerId: string, query: CustomerLoyaltyQueryDto, authEntity: AuthEntity): Promise<ICustomerLoyalty> {
    const customer = await this.loyaltyRepository.findCustomer(authEntity.restaurantId, customerId);
    if (!customer) throw new NotFoundException(LOYALTY_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);

    const [balance, entries, program] = await Promise.all([
      this.loyaltyRepository.getBalance(authEntity.restaurantId, customerId),
      this.loyaltyRepository.fetchEntries(authEntity.restaurantId, customerId, query),
      this.loyaltyRepository.findProgram(authEntity.restaurantId),
    ]);
    return { customer, balance, program: program ?? DEFAULT_LOYALTY_PROGRAM, entries };
  }
}
