import { FeedbackStatus, FeedbackType, StaffRole } from "@prisma/client";

export interface IFeedback {
  id: string;
  restaurantId: string;
  branchId: string | null;
  senderName: string;
  senderEmail: string;
  senderRole: StaffRole;
  type: FeedbackType;
  message: string;
  screenshotUrl: string | null;
  pagePath: string;
  status: FeedbackStatus;
  createdAt: Date;
}

/** What the operator's inbox shows: the note plus which restaurant sent it. */
export interface IFeedbackWithRestaurant extends IFeedback {
  restaurantName: string;
}
