import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchCustomersDto } from "../../application/dto/fetch-customers.dto";
import { ListCustomersUsecase } from "../../application/use-cases/list-customers.usecase";
import { CUSTOMER_SUCCESS_MESSAGES } from "../../domain/constants";
import { ICustomerListItem } from "../../domain/interfaces/customer.interface";

@Controller("restaurant/customers")
export class CustomerController {
  constructor(private readonly listCustomersUsecase: ListCustomersUsecase) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["customers:view"]]))
  async fetchAll(
    @Query() query: FetchCustomersDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<ICustomerListItem>>> {
    const customers = await this.listCustomersUsecase.execute(query, authEntity);
    return buildHttpResponse(customers, CUSTOMER_SUCCESS_MESSAGES.CUSTOMERS_FETCHED);
  }
}
