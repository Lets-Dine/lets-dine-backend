import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { generateQrToken } from "../../../tables/domain/utils/qr-token.util";
import { FLOOR_ERROR_MESSAGES } from "../../domain/constants";
import { IFloor } from "../../domain/interfaces/floor.interface";
import { FloorRepository } from "../../domain/repositories/floor.repository";

/** §29/§53 — rotating the token is how a leaked or photographed floor QR is retired. */
@Injectable()
export class RegenerateFloorQrUsecase {
  constructor(
    private readonly floorRepository: FloorRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IFloor> {
    const existing = await this.floorRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(FLOOR_ERROR_MESSAGES.NOT_FOUND);
    }

    const updated = await this.floorRepository.update(id, { qrToken: generateQrToken() }, { actorId: authEntity.sub });

    await this.auditLogService.record(
      { action: AuditAction.qr_regenerated, subject: existing.name, detail: "Previously printed codes for this floor no longer work" },
      authEntity
    );

    return updated;
  }
}
