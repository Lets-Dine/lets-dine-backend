import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../dishes/domain/constants";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../domain/repositories/dish-variant.repository";
import { CreateDishVariantInput } from "../../interfaces/http/validations/create-dish-variant.validation";

@Injectable()
export class CreateDishVariantUsecase {
  constructor(
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dishId: string, dto: CreateDishVariantInput, authEntity: AuthEntity): Promise<IDishVariant> {
    const dish = await this.dishRepository.findById(dishId);
    if (!dish || dish.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    const variant = await this.dishVariantRepository.create({ ...dto, dishId }, { actorId: authEntity.sub });

    await this.auditLogService.record({ action: AuditAction.dish_variant_created, subject: `${dish.name} — ${variant.name}` }, authEntity);

    return variant;
  }
}
