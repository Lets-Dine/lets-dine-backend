import { Controller, Get, Param } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchMenuUsecase } from "../../application/use-cases/fetch-menu.usecase";
import { MENU_SUCCESS_MESSAGES } from "../../domain/constants";
import { IMenu } from "../../domain/interfaces/menu.interface";

@Controller("public/restaurants")
export class PublicMenuController {
  constructor(private readonly fetchMenuUsecase: FetchMenuUsecase) {}

  @Get("/:slug/menu")
  async fetchMenu(@Param("slug") slug: string): Promise<IHttpResponse<IMenu>> {
    const menu = await this.fetchMenuUsecase.execute(slug);
    return buildHttpResponse(menu, MENU_SUCCESS_MESSAGES.MENU_FETCHED);
  }
}
