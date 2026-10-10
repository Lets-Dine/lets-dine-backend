import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { PrismaService } from "../../../../../common/prisma";
import { buildAuthEntity } from "../../../../../common/testing";
import { FetchReferralsUsecase } from "../fetch-referrals.usecase";

const authUser = buildAuthEntity({ restaurantId: "restaurant-1" });
const joinedAt = new Date("2026-03-01T00:00:00.000Z");
const rewardedAt = new Date("2026-03-28T00:00:00.000Z");

describe("FetchReferralsUsecase", () => {
  let usecase: FetchReferralsUsecase;
  let findUnique: jest.Mock;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn().mockResolvedValue({ slug: "newa-kitchen" });
    findMany = jest.fn().mockResolvedValue([
      { id: "invitee-1", name: "Momo Ghar", createdAt: joinedAt, referralRewardedAt: rewardedAt },
      { id: "invitee-2", name: "Himal Chulo", createdAt: joinedAt, referralRewardedAt: null },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchReferralsUsecase, { provide: PrismaService, useValue: { restaurant: { findUnique, findMany } } }],
    }).compile();
    usecase = module.get(FetchReferralsUsecase);
  });

  it("should return the invite code and each restaurant that joined through it", async () => {
    const view = await usecase.execute(authUser);

    expect(findMany).toHaveBeenCalledWith({
      where: { referredByRestaurantId: "restaurant-1" },
      select: { id: true, name: true, createdAt: true, referralRewardedAt: true },
      orderBy: { createdAt: "desc" },
    });
    expect(view).toEqual({
      code: "newa-kitchen",
      referrals: [
        { id: "invitee-1", name: "Momo Ghar", joinedAt, rewardedAt },
        { id: "invitee-2", name: "Himal Chulo", joinedAt, rewardedAt: null },
      ],
    });
  });

  it("should throw when the restaurant is gone", async () => {
    findUnique.mockResolvedValue(null);

    await expect(usecase.execute(authUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
