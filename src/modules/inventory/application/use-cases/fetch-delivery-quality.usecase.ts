import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ILotQuality } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { scoreLots } from "../../domain/utils/quality.util";
import { FetchQualityInput } from "../../interfaces/http/validations/fetch-quality.validation";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A review this low on taste or overall counts against the ingredients that went into the dish. */
const POOR_AT_OR_BELOW = 2;

/**
 * Walks from reviews back to deliveries: lot → the order lines that used it → the review of that
 * dish on that order. Only lots with at least one review come back; the rest have nothing to say.
 */
@Injectable()
export class FetchDeliveryQualityUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(query: FetchQualityInput, authEntity: AuthEntity): Promise<ILotQuality[]> {
    const since = new Date(Date.now() - query.days * DAY_MS);
    const uses = await this.inventoryRepository.findLotUses(authEntity.branchId, since);
    const reviews = await this.inventoryRepository.findReviewScores(
      authEntity.restaurantId,
      [...new Set(uses.map(use => use.orderId))],
      [...new Set(uses.map(use => use.dishId))]
    );
    const reviewByKey = new Map(reviews.map(review => [`${review.orderId}:${review.dishId}`, review]));

    const meta = new Map<string, (typeof uses)[number]>();
    const samples = uses.flatMap(use => {
      const review = reviewByKey.get(`${use.orderId}:${use.dishId}`);
      if (!review) return [];
      meta.set(use.lotId, use);
      return [
        { lotId: use.lotId, ingredientId: use.ingredientId, poor: review.taste <= POOR_AT_OR_BELOW || review.overall <= POOR_AT_OR_BELOW },
      ];
    });

    return scoreLots(samples)
      .map(score => {
        const lot = meta.get(score.lotId)!;
        return { ...score, ingredientName: lot.ingredientName, supplier: lot.supplier, receivedAt: lot.receivedAt };
      })
      .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.poorRate - a.poorRate || b.reviewCount - a.reviewCount);
  }
}
