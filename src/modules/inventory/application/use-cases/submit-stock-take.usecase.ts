import { Injectable } from "@nestjs/common";
import { AuditAction, StockMovementReason } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IStockTakeResult } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { SubmitStockTakeInput } from "../../interfaces/http/validations/submit-stock-take.validation";
import { InventoryService } from "../inventory.service";

/**
 * A blind count: staff enter what is on the shelf without being shown what the system expects (the
 * sheet endpoint never sends it). Only now are the two compared — every difference becomes a stock
 * correction, and the whole count lands in the audit log so shrinkage is on record, not just fixed.
 */
@Injectable()
export class SubmitStockTakeUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: SubmitStockTakeInput, authEntity: AuthEntity): Promise<IStockTakeResult[]> {
    const ids = dto.counts.map(count => count.ingredientId);
    const found = await this.inventoryRepository.findIngredientsByIds(ids, authEntity.branchId);
    // An ingredient from another branch is indistinguishable from a missing one.
    if (found.length !== ids.length) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    const costs = await this.inventoryRepository.findUnitCosts(authEntity.branchId);

    return this.inventoryRepository.$transaction(async tx => {
      const results: IStockTakeResult[] = [];
      const changed: string[] = [];

      for (const { ingredientId, quantity } of dto.counts) {
        // Re-read inside the transaction: orders may have used stock while the count was being typed in.
        const ingredient = await this.inventoryRepository.findIngredient(ingredientId, { tx });
        if (!ingredient) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);

        const difference = quantity - ingredient.quantity;
        const unitCost = costs.get(ingredientId)?.unit;
        results.push({
          ingredientId,
          name: ingredient.name,
          unit: ingredient.unit,
          expected: ingredient.quantity,
          counted: quantity,
          difference,
          value: unitCost === undefined ? null : Math.round(difference * unitCost),
        });
        if (difference === 0) continue;

        await this.inventoryRepository.applyMovement(
          ingredientId,
          difference,
          { reason: StockMovementReason.ADJUSTMENT, note: "Stock take", createdBy: authEntity.sub },
          tx
        );
        if (difference < 0) await this.inventoryService.drawFromLots(ingredientId, -difference, undefined, tx);
        changed.push(ingredientId);
      }

      await this.inventoryService.syncAvailability(authEntity.branchId, changed, tx);

      const off = results.filter(result => result.difference !== 0);
      await this.auditLogService.record(
        {
          action: AuditAction.stock_taken,
          subject: "Stock take",
          detail:
            off.length === 0
              ? `${results.length} counted, all matched`
              : `${results.length} counted, ${off.length} off: ${off.map(r => `${r.name} ${r.difference > 0 ? "+" : ""}${r.difference} ${r.unit}`).join(", ")}`,
        },
        authEntity,
        tx
      );
      return results;
    });
  }
}
