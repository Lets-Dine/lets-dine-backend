import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import {
  DishReviewFetchOptions,
  DishReviewRepository,
  IDishReviewCreate,
  IDishReviewsFetchOptions,
  IDishReviewsFetchQuery,
} from "../../domain/repositories/dish-review.repository";

const REVIEW_INCLUDE = { tags: { include: { tag: { select: { label: true } } } } } satisfies Prisma.DishReviewInclude;

type ReviewRow = Prisma.DishReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

@Injectable()
class DishReviewRepositoryImpl implements DishReviewRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: DishReviewFetchOptions): Promise<IDishReview | null> {
    const prisma = options?.tx ?? this.prisma;
    const review = await prisma.dishReview.findUnique({ where: { id }, include: REVIEW_INCLUDE });
    return review ? this.toReview(review) : null;
  }

  async findByOrderAndDish(orderId: string, dishId: string, options?: DishReviewFetchOptions): Promise<IDishReview | null> {
    const prisma = options?.tx ?? this.prisma;
    const review = await prisma.dishReview.findUnique({
      where: { orderId_dishId: { orderId, dishId } },
      include: REVIEW_INCLUDE,
    });
    return review ? this.toReview(review) : null;
  }

  async create(data: IDishReviewCreate, options?: { tx?: PrismaTransaction }): Promise<IDishReview> {
    const prisma = options?.tx ?? this.prisma;
    const { tagIds, ...review } = data;

    const created = await prisma.dishReview.create({
      data: {
        ...review,
        comment: review.comment ?? "",
        ...(tagIds?.length && { tags: { create: tagIds.map(tagId => ({ tagId })) } }),
      },
      include: REVIEW_INCLUDE,
    });

    return this.toReview(created);
  }

  async fetchAll(query: IDishReviewsFetchQuery, options?: IDishReviewsFetchOptions): Promise<PaginatedResponse<IDishReview>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt" | "overall">(options ?? {});
    console.log('orderBy', orderBy);

    const where: Prisma.DishReviewWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.dishId && { dishId: query.dishId }),
      ...(query.sessionId && { sessionId: query.sessionId }),
      ...(query.onlyWithComment && { comment: { not: "" } }),
      isHidden: query.isHidden ?? false,
      ...((query.minRating !== undefined || query.maxRating !== undefined) && {
        overall: {
          ...(query.minRating !== undefined && { gte: query.minRating }),
          ...(query.maxRating !== undefined && { lte: query.maxRating }),
        },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.dishReview.findMany({
            where,
            include: REVIEW_INCLUDE,
            ...paginationQuery,
            orderBy: orderBy ?? { createdAt: "desc" },
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.dishReview.count({ where }),
    ]);

    return { rows: rows.map(row => this.toReview(row)), count: count ?? 0 };
  }

  private toReview(review: ReviewRow): IDishReview {
    const { tags, ...rest } = review;
    return { ...rest, tags: tags.map(link => link.tag.label), verified: true };
  }
}

export default DishReviewRepositoryImpl;
