import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { CUSTOMER_ERROR_MESSAGES } from "../../domain/constants";
import { ICustomerProfile } from "../../domain/interfaces/customer.interface";
import { CustomerRepository } from "../../domain/repositories/customer.repository";
import { UpdateCustomerBody } from "../../interfaces/http/validations/update-customer.validation";

/** Name and phone are the diner's identity across restaurants, so they are not editable here. */
@Injectable()
export class UpdateCustomerUsecase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(id: string, patch: UpdateCustomerBody, authEntity: AuthEntity): Promise<ICustomerProfile> {
    const profile = await this.customerRepository.updateProfile(id, authEntity.restaurantId, patch);
    if (!profile) throw new NotFoundException(CUSTOMER_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);
    return profile;
  }
}
