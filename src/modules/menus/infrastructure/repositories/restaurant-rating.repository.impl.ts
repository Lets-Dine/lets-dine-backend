import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IRestaurantRating } from "../../domain/interfaces/menu.interface";
import { RestaurantRatingRepository } from "../../domain/repositories/restaurant-rating.repository";

@Injectable()
class RestaurantRatingRepositoryImpl implements RestaurantRatingRepository {
  constructor(private prisma: PrismaService) {}

  async fetchRating(restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<IRestaurantRating> {
    const prisma = options?.tx ?? this.prisma;
    const aggregate = await prisma.dishReview.aggregate({
      where: { restaurantId, isHidden: false },
      _avg: { overall: true },
      _count: { _all: true },
    });

    return {
      avgRating: aggregate._avg.overall === null ? null : Number(aggregate._avg.overall.toFixed(2)),
      ratingCount: aggregate._count._all,
    };
  }
}

export default RestaurantRatingRepositoryImpl;
