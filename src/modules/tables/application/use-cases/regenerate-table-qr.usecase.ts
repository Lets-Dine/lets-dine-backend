import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../domain/constants";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../domain/repositories/dining-table.repository";
import { generateQrToken } from "../../domain/utils/qr-token.util";

/** §29/§53 — rotating the token is how a leaked or photographed QR is retired. */
@Injectable()
export class RegenerateTableQrUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IDiningTable> {
    const existing = await this.diningTableRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);
    }

    const updated = await this.diningTableRepository.update(id, { qrToken: generateQrToken() }, { actorId: authEntity.sub });

    await this.auditLogService.record(
      {
        action: AuditAction.qr_regenerated,
        subject: existing.name,
        detail: "Previously printed codes for this table no longer work",
      },
      authEntity
    );

    return updated;
  }
}
