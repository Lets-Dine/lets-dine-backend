import { Controller, Get } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchPublicPlansUsecase } from "../../application/use-cases/fetch-public-plans.usecase";
import { BILLING_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPublicPlanCatalogue } from "../../domain/interfaces/billing.interface";

/** Pricing page. No auth: a restaurant owner reads this before they sign up. */
@Controller("public/plans")
export class PublicPlansController {
  constructor(private readonly fetchPublicPlansUsecase: FetchPublicPlansUsecase) {}

  @Get()
  async fetch(): Promise<IHttpResponse<IPublicPlanCatalogue>> {
    const catalogue = await this.fetchPublicPlansUsecase.execute();
    return buildHttpResponse(catalogue, BILLING_SUCCESS_MESSAGES.PLANS_FETCHED);
  }
}
