import { Injectable, Logger } from "@nestjs/common";
import { StockMovementReason } from "@prisma/client";
import { PrismaTransaction } from "../../../common/prisma";
import { EntitlementService } from "../../billing/application/entitlement.service";
import { InventoryRepository } from "../domain/repositories/inventory.repository";
import { resolveAutoConsume } from "../domain/utils/auto-consume.util";
import { allocateFifo } from "../domain/utils/lot.util";
import { canMakeOne, IOrderedItem, usageForItem } from "../domain/utils/recipe.util";

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  /**
   * Called when the kitchen starts a line (PENDING → PREPARING), inside that transition's
   * transaction. Takes the recipe's ingredients off stock and sold-outs any dish that can no longer
   * be made, unless the plan lacks the feature or auto-consume is off for the dish, its branch or the restaurant. A dish with no recipe is untouched — it stays on its manual availability switch.
   */
  async consumeForItem(
    item: IOrderedItem & { id: string; dishId: string },
    branchId: string,
    actorId: string,
    tx: PrismaTransaction
  ): Promise<void> {
    // Switched off for this dish, its branch or the restaurant: the kitchen starting it leaves stock alone.
    const settings = await this.inventoryRepository.findAutoConsumeSettings(item.dishId, tx);
    if (settings && !resolveAutoConsume(settings)) return;
    if (settings && !(await this.planAllowsAutoConsume(settings.restaurantId))) return;
    const rules = await this.inventoryRepository.findRecipeRules(item.dishId, tx);
    const usage = usageForItem(rules, item);
    for (const [ingredientId, quantity] of usage) {
      await this.inventoryRepository.applyMovement(
        ingredientId,
        -quantity,
        { reason: StockMovementReason.ORDER, orderItemId: item.id, createdBy: actorId },
        tx
      );
      await this.drawFromLots(ingredientId, quantity, item.id, tx);
    }
    await this.syncAvailability(branchId, [...usage.keys()], tx);
  }

  /** Whether the restaurant's plan includes automatic consumption. A billing fault never stops the kitchen: it counts as included. */
  private async planAllowsAutoConsume(restaurantId: string): Promise<boolean> {
    try {
      return await this.entitlementService.hasFeature(restaurantId, "autoStockConsumption");
    } catch (error) {
      this.logger.error(`Could not read the plan for restaurant ${restaurantId}`, error instanceof Error ? error.stack : String(error));
      return true;
    }
  }

  /**
   * Takes `quantity` off the oldest lots. With an `orderItemId` the order line is recorded against
   * each lot it drew from — the link that lets a review find its ingredients later. A recount
   * that removes stock passes none: the lot shrinks, but no order is implicated.
   */
  async drawFromLots(ingredientId: string, quantity: number, orderItemId: string | undefined, tx: PrismaTransaction): Promise<void> {
    // ponytail: read-then-write, so two kitchens drawing the same ingredient in the same instant can
    // both read one lot's `remaining`; lots only drive tracing, never the live quantity. Row-lock if it matters.
    const lots = await this.inventoryRepository.findOpenLots(ingredientId, tx);
    await this.inventoryRepository.applyLotUse(allocateFifo(lots, quantity), orderItemId, tx);
  }

  /**
   * Stock, not a person, flips the switch: a dish goes off when its base recipe can't be made and
   * back on after a restock — but only if stock was what turned it off (`autoSoldOut`).
   */
  async syncAvailability(branchId: string, ingredientIds: string[], tx: PrismaTransaction): Promise<void> {
    if (ingredientIds.length === 0) return;
    const dishes = await this.inventoryRepository.findDishesUsingBase(branchId, ingredientIds, tx);
    for (const dish of dishes) {
      const makeable = canMakeOne(dish.baseLines);
      if (!makeable && dish.isAvailable) {
        await this.inventoryRepository.setDishAvailability(dish.id, { isAvailable: false, autoSoldOut: true }, tx);
      } else if (makeable && !dish.isAvailable && dish.autoSoldOut) {
        await this.inventoryRepository.setDishAvailability(dish.id, { isAvailable: true, autoSoldOut: false }, tx);
      }
    }
  }
}
