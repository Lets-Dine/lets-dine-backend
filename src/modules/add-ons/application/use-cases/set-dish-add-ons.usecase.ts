import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../dishes/domain/constants";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { ADD_ON_ERROR_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";
import { SetDishAddOnsInput } from "../../interfaces/http/validations/set-dish-add-ons.validation";

/** Full-replace: the dish's linked add-ons become exactly the requested set. */
@Injectable()
export class SetDishAddOnsUsecase {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dishId: string, dto: SetDishAddOnsInput, authEntity: AuthEntity): Promise<IAddOn[]> {
    const dish = await this.dishRepository.findById(dishId);
    if (!dish || dish.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    const addOns = await this.addOnRepository.findManyByIds(dto.addOnIds);
    if (addOns.length !== dto.addOnIds.length || addOns.some(addOn => addOn.restaurantId !== authEntity.restaurantId)) {
      throw new BadRequestException(ADD_ON_ERROR_MESSAGES.INVALID_ADD_ON_IDS);
    }

    await this.addOnRepository.setDishLinks(dishId, dto.addOnIds);

    await this.auditLogService.record(
      { action: AuditAction.dish_add_ons_updated, subject: dish.name, detail: `${addOns.length} add-on(s) linked` },
      authEntity
    );

    return addOns;
  }
}
