import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { CUSTOMER_ERROR_MESSAGES } from "../../domain/constants";
import { ICustomerProfile } from "../../domain/interfaces/customer.interface";
import { CustomerRepository } from "../../domain/repositories/customer.repository";

@Injectable()
export class GetCustomerUsecase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<ICustomerProfile> {
    const profile = await this.customerRepository.getProfile(id, authEntity.restaurantId);
    if (!profile) throw new NotFoundException(CUSTOMER_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);
    return profile;
  }
}
