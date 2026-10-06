import { buildAuthEntity } from "../../../../../common/testing";
import { FeedbackRepository } from "../../../domain/repositories/feedback.repository";
import { SendFeedbackUsecase } from "../send-feedback.usecase";

describe("SendFeedbackUsecase", () => {
  it("takes who and where from the token, not the request", async () => {
    const repo = { create: jest.fn(async data => data) };
    const authUser = buildAuthEntity({ role: "STAFF" });

    await new SendFeedbackUsecase(repo as unknown as FeedbackRepository).execute(
      { type: "BUG", message: "Totals look off", pagePath: "/admin/ledger" },
      authUser
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: authUser.restaurantId,
        branchId: authUser.branchId,
        senderId: authUser.sub,
        senderRole: "STAFF",
        screenshotUrl: null,
      })
    );
  });
});
