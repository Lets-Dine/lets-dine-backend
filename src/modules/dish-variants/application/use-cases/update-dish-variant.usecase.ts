import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../dishes/domain/constants";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { DISH_VARIANT_ERROR_MESSAGES } from "../../domain/constants";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../domain/repositories/dish-variant.repository";
import { UpdateDishVariantInput } from "../../interfaces/http/validations/update-dish-variant.validation";

@Injectable()
export class UpdateDishVariantUsecase {
  constructor(
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dishId: string, variantId: string, dto: UpdateDishVariantInput, authEntity: AuthEntity): Promise<IDishVariant> {
    const dish = await this.dishRepository.findById(dishId);
    if (!dish || !isInActiveBranch(authEntity, dish)) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    const existing = await this.dishVariantRepository.findById(variantId);
    if (!existing || existing.dishId !== dishId) {
      throw new NotFoundException(DISH_VARIANT_ERROR_MESSAGES.NOT_FOUND);
    }

    const updated = await this.dishVariantRepository.update(variantId, dto, { actorId: authEntity.sub });

    const changedFields = Object.keys(dto);
    await this.auditLogService.record(
      {
        action: AuditAction.dish_variant_updated,
        subject: `${dish.name} — ${updated.name}`,
        detail: `Changed: ${changedFields.join(", ")}`,
      },
      authEntity
    );

    return updated;
  }
}
