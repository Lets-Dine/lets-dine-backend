import { FeedbackStatus, FeedbackType, StaffRole } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { IFeedback, IFeedbackWithRestaurant } from "../interfaces/feedback.interface";

export interface IFeedbackCreate {
  restaurantId: string;
  branchId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: StaffRole;
  type: FeedbackType;
  message: string;
  screenshotUrl: string | null;
  pagePath: string;
}

export interface IFeedbackFetchQuery {
  type?: FeedbackType;
  status?: FeedbackStatus;
}

export abstract class FeedbackRepository {
  abstract create(data: IFeedbackCreate): Promise<IFeedback>;
  abstract fetchAll(query: IFeedbackFetchQuery, options?: IPaginationOptions): Promise<PaginatedResponse<IFeedbackWithRestaurant>>;
  abstract updateStatus(id: string, status: FeedbackStatus): Promise<IFeedback | null>;
}
