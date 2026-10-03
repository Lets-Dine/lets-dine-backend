import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../dishes/domain/constants";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { DISH_VARIANT_ERROR_MESSAGES } from "../../domain/constants";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../domain/repositories/dish-variant.repository";

/** A variant with order history is archived, never deleted — mirrors ArchiveAddOnUsecase (§28). */
@Injectable()
export class ArchiveDishVariantUsecase {
  constructor(
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dishId: string, variantId: string, authEntity: AuthEntity): Promise<IDishVariant> {
    const dish = await this.dishRepository.findById(dishId);
    if (!dish || !isInActiveBranch(authEntity, dish)) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    const existing = await this.dishVariantRepository.findById(variantId);
    if (!existing || existing.dishId !== dishId) {
      throw new NotFoundException(DISH_VARIANT_ERROR_MESSAGES.NOT_FOUND);
    }
    if (existing.isArchived) throw new ConflictException(DISH_VARIANT_ERROR_MESSAGES.ALREADY_ARCHIVED);

    const archived = await this.dishVariantRepository.update(
      variantId,
      { isArchived: true, isAvailable: false },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record(
      { action: AuditAction.dish_variant_archived, subject: `${dish.name} — ${existing.name}` },
      authEntity
    );

    return archived;
  }
}
