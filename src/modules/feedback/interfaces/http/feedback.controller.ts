import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules, PlatformGuard } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import {
  CreateUploadSignatureUsecase,
  type IUploadSignature,
} from "../../../uploads/application/use-cases/create-upload-signature.usecase";
import { CreateFeedbackDto, FetchFeedbackDto, UpdateFeedbackStatusDto } from "../../application/dto/feedback.dto";
import { SendFeedbackUsecase } from "../../application/use-cases/send-feedback.usecase";
import { UpdateFeedbackStatusUsecase } from "../../application/use-cases/update-feedback-status.usecase";
import { FEEDBACK_SUCCESS_MESSAGES } from "../../domain/constants";
import { IFeedback, IFeedbackWithRestaurant } from "../../domain/interfaces/feedback.interface";
import { FeedbackRepository } from "../../domain/repositories/feedback.repository";

/** Every role may write to the product team — `orders:view` is the one permission all three hold. */
const ANY_STAFF = checkPermissionRules([["orders:view"]]);

@Controller("restaurant/feedback")
export class FeedbackController {
  constructor(
    private readonly sendFeedbackUsecase: SendFeedbackUsecase,
    private readonly signer: CreateUploadSignatureUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(ANY_STAFF)
  async send(@Body() dto: CreateFeedbackDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IFeedback>> {
    return buildHttpResponse(await this.sendFeedbackUsecase.execute(dto, authEntity), FEEDBACK_SUCCESS_MESSAGES.SENT);
  }

  /** A signed slip to upload one screenshot into this restaurant's own feedback folder. */
  @Post("screenshot-signature")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(ANY_STAFF)
  async screenshotSignature(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IUploadSignature>> {
    return buildHttpResponse(
      this.signer.sign(`lets-dine/${authEntity.restaurantId}/feedback`),
      FEEDBACK_SUCCESS_MESSAGES.SIGNATURE_CREATED
    );
  }
}

/** The operator's inbox. */
@Controller("platform/feedback")
@UseGuards(PlatformGuard)
export class PlatformFeedbackController {
  constructor(
    private readonly feedbackRepository: FeedbackRepository,
    private readonly updateFeedbackStatusUsecase: UpdateFeedbackStatusUsecase
  ) {}

  @Get()
  async fetchAll(@Query() query: FetchFeedbackDto): Promise<IHttpResponse<PaginatedResponse<IFeedbackWithRestaurant>>> {
    const { type, status, ...pagination } = query;
    return buildHttpResponse(await this.feedbackRepository.fetchAll({ type, status }, pagination), FEEDBACK_SUCCESS_MESSAGES.FETCHED);
  }

  @Patch(":id/status")
  async updateStatus(@Param("id", ParseUuidPipe) id: string, @Body() dto: UpdateFeedbackStatusDto): Promise<IHttpResponse<IFeedback>> {
    return buildHttpResponse(await this.updateFeedbackStatusUsecase.execute(id, dto.status), FEEDBACK_SUCCESS_MESSAGES.STATUS_UPDATED);
  }
}
