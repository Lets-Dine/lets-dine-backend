import { Module } from "@nestjs/common";
import { UploadsModule } from "../uploads/uploads.module";
import { SendFeedbackUsecase } from "./application/use-cases/send-feedback.usecase";
import { UpdateFeedbackStatusUsecase } from "./application/use-cases/update-feedback-status.usecase";
import { FeedbackRepository } from "./domain/repositories/feedback.repository";
import FeedbackRepositoryImpl from "./infrastructure/repositories/feedback.repository.impl";
import { FeedbackController, PlatformFeedbackController } from "./interfaces/http/feedback.controller";

@Module({
  imports: [UploadsModule],
  controllers: [FeedbackController, PlatformFeedbackController],
  providers: [
    SendFeedbackUsecase,
    UpdateFeedbackStatusUsecase,
    FeedbackRepositoryImpl,
    { provide: FeedbackRepository, useExisting: FeedbackRepositoryImpl },
  ],
})
export class FeedbackModule {}
