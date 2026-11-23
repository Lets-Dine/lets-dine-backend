import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ICustomer } from "../../domain/interfaces/customer.interface";
import { CustomerRepository } from "../../domain/repositories/customer.repository";
import { CreateCustomerBody } from "../../interfaces/http/validations/create-customer.validation";

/**
 * Saves a customer so a bill can go on their name: for loyalty points, or on credit. A phone this restaurant already
 * knows gives that customer back untouched: a name typed at the till must not rename someone's identity.
 */
@Injectable()
export class CreateCustomerUsecase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(dto: CreateCustomerBody, authEntity: AuthEntity): Promise<ICustomer> {
    const existing = await this.customerRepository.findByPhone(authEntity.restaurantId, dto.phone);
    if (existing) return existing;
    return this.customerRepository.upsert({ restaurantId: authEntity.restaurantId, phone: dto.phone, name: dto.name });
  }
}
