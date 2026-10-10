import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { PrismaService } from "../../../../common/prisma";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { IReferrals } from "../../domain/interfaces/billing.interface";

/** The invite code and every restaurant that joined through it. */
@Injectable()
export class FetchReferralsUsecase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(authEntity: AuthEntity): Promise<IReferrals> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: authEntity.restaurantId },
      select: { slug: true },
    });
    if (!restaurant) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);

    const rows = await this.prisma.restaurant.findMany({
      where: { referredByRestaurantId: authEntity.restaurantId },
      select: { id: true, name: true, createdAt: true, referralRewardedAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      code: restaurant.slug,
      referrals: rows.map(row => ({ id: row.id, name: row.name, joinedAt: row.createdAt, rewardedAt: row.referralRewardedAt })),
    };
  }
}
