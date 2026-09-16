import { Controller, Get, Param, Query } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { IDishRail } from "../../../dishes/domain/interfaces/dish-rail.interface";
import { FetchMenuHighlightsDto } from "../../application/dto/fetch-menu-highlights.dto";
import { FetchMenuHighlightsUsecase } from "../../application/use-cases/fetch-menu-highlights.usecase";
import { FetchMenuUsecase } from "../../application/use-cases/fetch-menu.usecase";
import { MENU_SUCCESS_MESSAGES } from "../../domain/constants";
import { IMenu } from "../../domain/interfaces/menu.interface";

@Controller("public/restaurants")
export class PublicMenuController {
  constructor(
    private readonly fetchMenuUsecase: FetchMenuUsecase,
    private readonly fetchMenuHighlightsUsecase: FetchMenuHighlightsUsecase
  ) {}

  @Get("/:slug/menu")
  async fetchMenu(@Param("slug") slug: string): Promise<IHttpResponse<IMenu>> {
    const menu = await this.fetchMenuUsecase.execute(slug);
    return buildHttpResponse(menu, MENU_SUCCESS_MESSAGES.MENU_FETCHED);
  }

  /** Most loved here, trending today, hidden gems, best value — §24's rails. */
  @Get("/:slug/highlights")
  async fetchHighlights(@Param("slug") slug: string, @Query() query: FetchMenuHighlightsDto): Promise<IHttpResponse<IDishRail[]>> {
    const rails = await this.fetchMenuHighlightsUsecase.execute(slug, query);
    return buildHttpResponse(rails, MENU_SUCCESS_MESSAGES.MENU_HIGHLIGHTS_FETCHED);
  }
}
