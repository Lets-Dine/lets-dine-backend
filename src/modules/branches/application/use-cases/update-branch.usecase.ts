import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { slugify } from "../../../dishes/domain/utils/slug.util";
import { BRANCH_ERROR_MESSAGES } from "../../domain/constants";
import { IBranch } from "../../domain/interfaces/branch.interface";
import { BranchRepository, IBranchUpdate } from "../../domain/repositories/branch.repository";
import { UpdateBranchInput } from "../../interfaces/http/validations/update-branch.validation";

@Injectable()
export class UpdateBranchUsecase {
  constructor(
    private readonly branchRepository: BranchRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateBranchInput, authEntity: AuthEntity): Promise<IBranch> {
    const existing = await this.branchRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);
    }

    if (dto.isActive === false && existing.isDefault) {
      throw new BadRequestException(BRANCH_ERROR_MESSAGES.DEFAULT_CANNOT_BE_DISABLED);
    }

    const data: IBranchUpdate = { ...dto };
    if (dto.name && dto.name !== existing.name) {
      const slug = slugify(dto.name);
      if (slug !== existing.slug) {
        const clash = await this.branchRepository.findBySlug(authEntity.restaurantId, slug);
        if (clash) throw new ConflictException(BRANCH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);
        data.slug = slug;
      }
    }

    const updated = await this.branchRepository.update(id, data, { actorId: authEntity.sub });

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.auditLogService.record(
        {
          action: dto.isActive ? AuditAction.branch_enabled : AuditAction.branch_disabled,
          subject: updated.name,
          detail: dto.isActive ? "Back in service" : "Out of service",
        },
        authEntity
      );
    }

    const otherChanges = Object.keys(dto).filter(key => key !== "isActive");
    if (otherChanges.length > 0) {
      await this.auditLogService.record(
        { action: AuditAction.branch_updated, subject: updated.name, detail: `Changed: ${otherChanges.join(", ")}` },
        authEntity
      );
    }

    return updated;
  }
}
