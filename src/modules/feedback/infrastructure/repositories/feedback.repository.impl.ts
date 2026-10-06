import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService } from "../../../../common/prisma";
import { IFeedback, IFeedbackWithRestaurant } from "../../domain/interfaces/feedback.interface";
import { FeedbackRepository, IFeedbackCreate, IFeedbackFetchQuery } from "../../domain/repositories/feedback.repository";

@Injectable()
class FeedbackRepositoryImpl implements FeedbackRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: IFeedbackCreate): Promise<IFeedback> {
    return this.prisma.feedback.create({ data });
  }

  async fetchAll(query: IFeedbackFetchQuery, options?: IPaginationOptions): Promise<PaginatedResponse<IFeedbackWithRestaurant>> {
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});
    const where: Prisma.FeedbackWhereInput = { ...(query.type && { type: query.type }), ...(query.status && { status: query.status }) };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : this.prisma.feedback
            .findMany({
              where,
              ...paginationQuery,
              orderBy: orderBy ?? { createdAt: "desc" },
              include: { restaurant: { select: { name: true } } },
            })
            .then(found => found.map(({ restaurant, ...row }) => ({ ...row, restaurantName: restaurant.name }))),
      options?.returnCount === false ? Promise.resolve(-1) : this.prisma.feedback.count({ where }),
    ]);
    return { rows, count };
  }

  async updateStatus(id: string, status: Parameters<FeedbackRepository["updateStatus"]>[1]): Promise<IFeedback | null> {
    return this.prisma.feedback.update({ where: { id }, data: { status } }).catch(() => null);
  }
}

export default FeedbackRepositoryImpl;
