import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchMarginsDto } from "../../dish-margins.dto";
import { IDishMargins } from "../../dish-margins.interface";
import { DishMarginRepository } from "../../infrastructure/dish-margin.repository";
import { shapeMargin } from "../../margin.util";

const DAY = 86_400_000;

/** What dishes cost to make against what they sell for. Costs are the owner's business, so it needs both the stock and the money views. */
@Controller("restaurant/dish-margins")
@UseGuards(AuthGuard, AbilityGuard)
export class DishMarginController {
  constructor(private readonly repository: DishMarginRepository) {}

  @Get()
  @CheckPolicies(checkPermissionRules([["inventory:view", "payments:view"]]))
  async fetch(@Query() query: FetchMarginsDto, @AuthUser() auth: AuthEntity): Promise<IHttpResponse<IDishMargins>> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * DAY);
    const rows = await this.repository.fetch({ restaurantId: auth.restaurantId, branchId: auth.branchId, from, to, sortBy: query.sortBy });
    return buildHttpResponse({ from, to, rows: rows.map(shapeMargin) }, { key: "DISH_MARGINS_FETCHED", message: "Dish margins fetched" });
  }
}
