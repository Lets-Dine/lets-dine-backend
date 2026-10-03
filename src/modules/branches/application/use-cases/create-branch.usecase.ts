import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { slugify } from "../../../dishes/domain/utils/slug.util";
import { BRANCH_ERROR_MESSAGES } from "../../domain/constants";
import { IBranch } from "../../domain/interfaces/branch.interface";
import { BranchRepository } from "../../domain/repositories/branch.repository";
import { CopyBranchMenuUsecase } from "./copy-branch-menu.usecase";
import { CreateBranchInput } from "../../interfaces/http/validations/create-branch.validation";

@Injectable()
export class CreateBranchUsecase {
  constructor(
    private readonly branchRepository: BranchRepository,
    private readonly auditLogService: AuditLogService,
    private readonly copyBranchMenuUsecase: CopyBranchMenuUsecase
  ) {}

  async execute(dto: CreateBranchInput, authEntity: AuthEntity): Promise<IBranch> {
    const { copyMenuFrom, ...fields } = dto;
    const slug = slugify(dto.name);
    const clash = await this.branchRepository.findBySlug(authEntity.restaurantId, slug);
    if (clash) throw new ConflictException(BRANCH_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);

    const branch = await this.branchRepository.create(
      { ...fields, slug, restaurantId: authEntity.restaurantId },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.branch_created, subject: branch.name }, authEntity);

    // The branch exists either way; if the copy fails it can be retried from the branch's own page, since the menu is still empty.
    if (copyMenuFrom) await this.copyBranchMenuUsecase.execute(branch.id, copyMenuFrom, authEntity);

    return branch;
  }
}
