import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { ICustomerListItem } from "../../domain/interfaces/customer.interface";
import { CustomerRepository } from "../../domain/repositories/customer.repository";
import { FetchCustomersQuery } from "../../interfaces/http/validations/fetch-customers.validation";

@Injectable()
export class ListCustomersUsecase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  execute(query: FetchCustomersQuery, authEntity: AuthEntity): Promise<PaginatedResponse<ICustomerListItem>> {
    const { q, segment, sortBy, sortOrder, limit, offset, returnData } = query;
    return this.customerRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, q, segment },
      { sortBy, sortOrder, limit, offset, returnData }
    );
  }
}
