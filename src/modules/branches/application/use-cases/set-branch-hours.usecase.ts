import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { BRANCH_ERROR_MESSAGES } from "../../domain/constants";
import { IBranchHours } from "../../domain/interfaces/branch.interface";
import { BranchRepository } from "../../domain/repositories/branch.repository";
import { SetBranchHoursInput } from "../../interfaces/http/validations/set-branch-hours.validation";

@Injectable()
export class SetBranchHoursUsecase {
  constructor(
    private readonly branchRepository: BranchRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: SetBranchHoursInput, authEntity: AuthEntity): Promise<IBranchHours[]> {
    const branch = await this.branchRepository.findById(id);
    if (!branch || branch.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);
    }

    // `HH:mm` compares correctly as a string. Overnight ranges are modelled as two entries.
    if (dto.hours.some(entry => !entry.isClosed && entry.opensAt >= entry.closesAt)) {
      throw new BadRequestException(BRANCH_ERROR_MESSAGES.INVALID_HOURS);
    }

    const hours = await this.branchRepository.replaceHours(id, dto.hours);

    await this.auditLogService.record({ action: AuditAction.branch_hours_updated, subject: branch.name }, authEntity);

    return hours;
  }
}
