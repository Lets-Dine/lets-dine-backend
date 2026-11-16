import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateUploadSignatureDto } from "../../application/dto/create-upload-signature.dto";
import { CreateUploadSignatureUsecase, IUploadSignature } from "../../application/use-cases/create-upload-signature.usecase";
import { UPLOAD_SUCCESS_MESSAGES } from "../../domain/constants";

@Controller("restaurant/uploads")
export class UploadController {
  constructor(private readonly createUploadSignatureUsecase: CreateUploadSignatureUsecase) {}

  @Post("/signature")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"], ["settings:edit"]]))
  async createSignature(
    @Body() dto: CreateUploadSignatureDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IUploadSignature>> {
    const signature = this.createUploadSignatureUsecase.execute(dto, authEntity);
    return buildHttpResponse(signature, UPLOAD_SUCCESS_MESSAGES.SIGNATURE_CREATED);
  }

  // ponytail: no per-user throttle on signatures; add one if avatar uploads are ever abused.
  @Post("/avatar-signature")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async createAvatarSignature(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IUploadSignature>> {
    return buildHttpResponse(this.createUploadSignatureUsecase.executeAvatar(authEntity), UPLOAD_SUCCESS_MESSAGES.SIGNATURE_CREATED);
  }
}
