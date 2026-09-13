import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDish } from "../../domain/interfaces/dish.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";
import { ReorderDishesInput } from "../../interfaces/http/validations/reorder-dishes.validation";

@Injectable()
export class ReorderDishesUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: ReorderDishesInput, authEntity: AuthEntity): Promise<IDish[]> {
    const dishes = await this.dishRepository.$transaction(async tx => {
      const updated: IDish[] = [];

      for (const item of dto.items) {
        const existing = await this.dishRepository.findById(item.id, { tx });
        if (!existing || existing.restaurantId !== authEntity.restaurantId) {
          throw new NotFoundException({ ...DISH_ERROR_MESSAGES.NOT_FOUND, detail: { id: item.id } });
        }

        updated.push(await this.dishRepository.update(item.id, { sortOrder: item.sortOrder }, { tx, actorId: authEntity.sub }));
      }

      return updated;
    });

    await this.auditLogService.record(
      { action: AuditAction.dish_reordered, subject: "Menu", detail: `${dishes.length} dishes repositioned` },
      authEntity
    );

    return dishes;
  }
}
