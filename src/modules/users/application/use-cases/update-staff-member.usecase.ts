import { Injectable } from "@nestjs/common";
import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../domain/constants";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../domain/repositories/restaurant-member.repository";
import { UpdateStaffMemberInput } from "../../interfaces/http/validations/update-staff-member.validation";

@Injectable()
export class UpdateStaffMemberUsecase {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly auditLogService: AuditLogService,
    private readonly branchRepository: BranchRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  async execute(id: string, dto: UpdateStaffMemberInput, authEntity: AuthEntity): Promise<IStaffMember> {
    const member = await this.restaurantMemberRepository.findById(id);
    if (!member || member.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(STAFF_MEMBER_ERROR_MESSAGES.NOT_FOUND);
    }

    if (member.id === authEntity.memberId) throw new ForbiddenException(STAFF_MEMBER_ERROR_MESSAGES.CANNOT_EDIT_SELF);

    await this.guardLastOwner(member, dto);

    // Reactivating somebody takes a seat again, so it is held to the plan like adding a new one.
    if (dto.isActive === true && !member.isActive) {
      await this.entitlementService.assertCanCreate("seat", authEntity.restaurantId);
    }

    const branchIds = await this.resolveBranchIds(member, dto, authEntity);
    const updated = await this.restaurantMemberRepository.update(id, { ...dto, branchIds });

    if (branchIds && !sameIds(branchIds, member.branchIds)) {
      await this.auditLogService.record(
        {
          action: AuditAction.staff_branches_changed,
          subject: member.name,
          detail: `${member.branchIds.length} → ${branchIds.length} branches`,
        },
        authEntity
      );
    }

    if (dto.role && dto.role !== member.role) {
      await this.auditLogService.record(
        { action: AuditAction.staff_role_changed, subject: member.name, detail: `${member.role} → ${dto.role}` },
        authEntity
      );
    }

    if (dto.isActive === false && member.isActive) {
      await this.auditLogService.record(
        { action: AuditAction.staff_deactivated, subject: member.name, detail: "Access removed" },
        authEntity
      );
    }

    return updated;
  }

  /**
   * Explicit ids are validated against this restaurant. Demoting an OWNER (who needed no assignments)
   * without saying where they work would lock them out at sign-in, so they land in the editor's branch.
   */
  private async resolveBranchIds(member: IStaffMember, dto: UpdateStaffMemberInput, authEntity: AuthEntity): Promise<string[] | undefined> {
    const newRole = dto.role ?? member.role;
    if (newRole === StaffRole.OWNER) return undefined;

    const demoted = member.role === StaffRole.OWNER;
    const requested = dto.branchIds ? [...new Set(dto.branchIds)] : demoted ? [authEntity.branchId] : undefined;
    if (!requested) return undefined;

    const valid = await this.branchRepository.findActiveByIds(authEntity.restaurantId, requested);
    if (valid.length !== requested.length) throw new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.INVALID_BRANCHES);
    return requested;
  }

  /** A restaurant with no active owner has nobody who can change its settings. */
  private async guardLastOwner(member: IStaffMember, dto: UpdateStaffMemberInput): Promise<void> {
    const losingOwner = member.role === StaffRole.OWNER && (dto.isActive === false || (dto.role && dto.role !== StaffRole.OWNER));
    if (!losingOwner) return;

    const activeOwners = await this.restaurantMemberRepository.countActiveByRole(member.restaurantId, StaffRole.OWNER);
    if (activeOwners <= 1) throw new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.LAST_OWNER);
  }
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(id => b.includes(id));
}
