import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, CheckPolicies, checkPermissionRules, PlatformGuard } from "../../../../common/auth";
import { IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import {
  CreateUploadSignatureUsecase,
  type IUploadSignature,
} from "../../../uploads/application/use-cases/create-upload-signature.usecase";
import { CreateDishPhotoDto, SuggestDishPhotosDto } from "../../application/dish-photo.dto";
import { DishPhotosService, type IDishPhoto } from "../../application/dish-photos.service";
import { DISH_PHOTO_MESSAGES } from "../../dish-photos.constants";

/** The operator curates the library. */
@Controller("platform/dish-photos")
@UseGuards(PlatformGuard)
export class PlatformDishPhotoController {
  constructor(
    private readonly photos: DishPhotosService,
    private readonly signer: CreateUploadSignatureUsecase
  ) {}

  @Get()
  async list(): Promise<IHttpResponse<IDishPhoto[]>> {
    return buildHttpResponse(await this.photos.list(), DISH_PHOTO_MESSAGES.FETCHED);
  }

  @Post()
  async create(@Body() dto: CreateDishPhotoDto): Promise<IHttpResponse<IDishPhoto>> {
    return buildHttpResponse(await this.photos.create(dto), DISH_PHOTO_MESSAGES.CREATED);
  }

  /** Library uploads are platform-owned, so they get a folder of their own rather than a restaurant's. */
  @Post("/signature")
  @HttpCode(201)
  async signature(): Promise<IHttpResponse<IUploadSignature>> {
    return buildHttpResponse(this.signer.sign("lets-dine/platform/dish-library"), DISH_PHOTO_MESSAGES.FETCHED);
  }

  @Delete("/:id")
  async remove(@Param("id", ParseUuidPipe) id: string): Promise<IHttpResponse<null>> {
    await this.photos.remove(id);
    return buildHttpResponse(null, DISH_PHOTO_MESSAGES.DELETED);
  }
}

/** Restaurants only read it, while adding or editing a dish. */
@Controller("restaurant/dish-photos")
@UseGuards(AuthGuard, AbilityGuard)
export class RestaurantDishPhotoController {
  constructor(private readonly photos: DishPhotosService) {}

  @Get()
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async suggest(@Query() query: SuggestDishPhotosDto): Promise<IHttpResponse<IDishPhoto[]>> {
    return buildHttpResponse(await this.photos.suggest(query.name), DISH_PHOTO_MESSAGES.FETCHED);
  }
}
