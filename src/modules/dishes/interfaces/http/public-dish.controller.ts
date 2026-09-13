import { Controller, Get, Param } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchDishByIdUsecase } from "../../application/use-cases/fetch-dish-by-id.usecase";
import { DISH_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";

@Controller("public/dishes")
export class PublicDishController {
  constructor(private readonly fetchDishByIdUsecase: FetchDishByIdUsecase) {}

  @Get("/:id")
  async fetchById(@Param("id", ParseUuidPipe) id: string): Promise<IHttpResponse<IDishWithStats>> {
    const dish = await this.fetchDishByIdUsecase.execute(id);
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_FETCHED);
  }
}
