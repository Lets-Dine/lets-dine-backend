import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../domain/constants";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../domain/repositories/dining-table.repository";
import { generateQrToken } from "../../domain/utils/qr-token.util";
import { CreateTableInput } from "../../interfaces/http/validations/create-table.validation";

@Injectable()
export class CreateTableUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateTableInput, authEntity: AuthEntity): Promise<IDiningTable> {
    const existing = await this.diningTableRepository.findByName(authEntity.restaurantId, dto.name);
    if (existing) throw new ConflictException(DINING_TABLE_ERROR_MESSAGES.NAME_ALREADY_EXISTS);

    const table = await this.diningTableRepository.create(
      { ...dto, restaurantId: authEntity.restaurantId, qrToken: generateQrToken() },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record(
      { action: AuditAction.table_created, subject: table.name, detail: `Seats ${table.capacity}` },
      authEntity
    );

    return table;
  }
}
