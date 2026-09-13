import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDish } from "../../domain/interfaces/dish.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";

/** §28 — a dish with order history is archived, never deleted: old orders must still read correctly. */
@Injectable()
export class ArchiveDishUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IDish> {
    const existing = await this.dishRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }
    if (existing.isArchived) throw new ConflictException(DISH_ERROR_MESSAGES.ALREADY_ARCHIVED);

    const archived = await this.dishRepository.update(
      id,
      { isArchived: true, isAvailable: false, isFeatured: false },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.dish_archived, subject: existing.name }, authEntity);

    return archived;
  }
}
