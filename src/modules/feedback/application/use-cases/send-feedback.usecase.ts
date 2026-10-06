import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IFeedback } from "../../domain/interfaces/feedback.interface";
import { FeedbackRepository } from "../../domain/repositories/feedback.repository";
import { CreateFeedbackInput } from "../../interfaces/http/validations/feedback.validation";

/** Any signed-in staff member may write to the product team; who and where are read off the token, never the body. */
@Injectable()
export class SendFeedbackUsecase {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

  async execute(dto: CreateFeedbackInput, authEntity: AuthEntity): Promise<IFeedback> {
    return this.feedbackRepository.create({
      restaurantId: authEntity.restaurantId,
      branchId: authEntity.branchId,
      senderId: authEntity.sub,
      senderName: authEntity.name,
      senderEmail: authEntity.email,
      senderRole: authEntity.role,
      type: dto.type,
      message: dto.message,
      screenshotUrl: dto.screenshotUrl ?? null,
      pagePath: dto.pagePath,
    });
  }
}
