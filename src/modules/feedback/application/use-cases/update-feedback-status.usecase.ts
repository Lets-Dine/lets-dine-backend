import { Injectable } from "@nestjs/common";
import { FeedbackStatus } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { FEEDBACK_ERROR_MESSAGES } from "../../domain/constants";
import { IFeedback } from "../../domain/interfaces/feedback.interface";
import { FeedbackRepository } from "../../domain/repositories/feedback.repository";

@Injectable()
export class UpdateFeedbackStatusUsecase {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

  async execute(id: string, status: FeedbackStatus): Promise<IFeedback> {
    const updated = await this.feedbackRepository.updateStatus(id, status);
    if (!updated) throw new NotFoundException(FEEDBACK_ERROR_MESSAGES.NOT_FOUND);
    return updated;
  }
}
