import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { generateQrToken } from "../../../tables/domain/utils/qr-token.util";
import { FLOOR_ERROR_MESSAGES } from "../../domain/constants";
import { IFloor } from "../../domain/interfaces/floor.interface";
import { FloorRepository } from "../../domain/repositories/floor.repository";
import { CreateFloorInput } from "../../interfaces/http/validations/create-floor.validation";

@Injectable()
export class CreateFloorUsecase {
  constructor(
    private readonly floorRepository: FloorRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateFloorInput, authEntity: AuthEntity): Promise<IFloor> {
    const existing = await this.floorRepository.findByName(authEntity.branchId, dto.name);
    if (existing) throw new ConflictException(FLOOR_ERROR_MESSAGES.NAME_ALREADY_EXISTS);

    const floor = await this.floorRepository.create(
      { ...dto, restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, qrToken: generateQrToken() },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.floor_created, subject: floor.name }, authEntity);

    return floor;
  }
}
