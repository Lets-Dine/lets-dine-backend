import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";
import { describeSettingsChange } from "../../domain/utils/describe-settings-change.util";
import { UpdateRestaurantInput } from "../../interfaces/http/validations/update-restaurant.validation";

@Injectable()
export class UpdateRestaurantUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: UpdateRestaurantInput, authEntity: AuthEntity): Promise<IRestaurant> {
    const existing = await this.restaurantRepository.findById(authEntity.restaurantId);
    if (!existing) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const updated = await this.restaurantRepository.update(existing.id, dto, { actorId: authEntity.sub });

    const detail = describeSettingsChange(existing, updated);
    if (detail) {
      await this.auditLogService.record({ action: AuditAction.settings_updated, subject: existing.name, detail }, authEntity);
    }

    return updated;
  }
}
