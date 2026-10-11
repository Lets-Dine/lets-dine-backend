import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { AdjustLoyaltyDto, CustomerLoyaltyQueryDto } from "../../application/dto/loyalty.dto";
import { AdjustLoyaltyUsecase } from "../../application/use-cases/adjust-loyalty.usecase";
import { GetCustomerLoyaltyUsecase } from "../../application/use-cases/get-customer-loyalty.usecase";
import { LOYALTY_SUCCESS_MESSAGES } from "../../domain/constants";
import { ICustomerLoyalty, ILoyaltyEntry } from "../../domain/interfaces/loyalty.interface";

const GUARDS = [AuthGuard, AbilityGuard] as const;

/** One customer's points at the restaurant the token belongs to. Reading follows the customers book; changing points is a discount, so it follows `payments:discount`. */
@Controller("restaurant/customers/:customerId/loyalty")
export class LoyaltyController {
  constructor(
    private readonly getCustomerLoyaltyUsecase: GetCustomerLoyaltyUsecase,
    private readonly adjustLoyaltyUsecase: AdjustLoyaltyUsecase
  ) {}

  @Get()
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["customers:view"]]))
  async fetch(
    @Param("customerId", ParseUuidPipe) customerId: string,
    @Query() query: CustomerLoyaltyQueryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<ICustomerLoyalty>> {
    return buildHttpResponse(
      await this.getCustomerLoyaltyUsecase.execute(customerId, query, authEntity),
      LOYALTY_SUCCESS_MESSAGES.LOYALTY_FETCHED
    );
  }

  @Post("adjust")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["payments:discount"]]))
  async adjust(
    @Param("customerId", ParseUuidPipe) customerId: string,
    @Body() dto: AdjustLoyaltyDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<{ balance: number; entry: ILoyaltyEntry }>> {
    return buildHttpResponse(
      await this.adjustLoyaltyUsecase.execute(customerId, dto, authEntity),
      LOYALTY_SUCCESS_MESSAGES.LOYALTY_ADJUSTED
    );
  }
}
