import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { UpdateCustomerDto } from "../../application/dto/update-customer.dto";
import { GetCustomerUsecase } from "../../application/use-cases/get-customer.usecase";
import { UpdateCustomerUsecase } from "../../application/use-cases/update-customer.usecase";
import { FetchCustomersDto } from "../../application/dto/fetch-customers.dto";
import { ListCustomersUsecase } from "../../application/use-cases/list-customers.usecase";
import { CUSTOMER_SUCCESS_MESSAGES } from "../../domain/constants";
import { ICustomerListItem, ICustomerProfile } from "../../domain/interfaces/customer.interface";

@Controller("restaurant/customers")
export class CustomerController {
  constructor(
    private readonly listCustomersUsecase: ListCustomersUsecase,
    private readonly getCustomerUsecase: GetCustomerUsecase,
    private readonly updateCustomerUsecase: UpdateCustomerUsecase
  ) {}

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

  @Get(":id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["customers:view"]]))
  async fetchOne(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ICustomerProfile>> {
    return buildHttpResponse(await this.getCustomerUsecase.execute(id, authEntity), CUSTOMER_SUCCESS_MESSAGES.CUSTOMER_FETCHED);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["customers:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<ICustomerProfile>> {
    return buildHttpResponse(await this.updateCustomerUsecase.execute(id, dto, authEntity), CUSTOMER_SUCCESS_MESSAGES.CUSTOMER_UPDATED);
  }
}
