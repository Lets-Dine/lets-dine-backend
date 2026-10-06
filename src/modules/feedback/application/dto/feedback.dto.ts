import { createZodDto } from "nestjs-zod";
import {
  createFeedbackSchema,
  fetchFeedbackSchema,
  updateFeedbackStatusSchema,
} from "../../interfaces/http/validations/feedback.validation";

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
export class FetchFeedbackDto extends createZodDto(fetchFeedbackSchema) {}
export class UpdateFeedbackStatusDto extends createZodDto(updateFeedbackStatusSchema) {}
