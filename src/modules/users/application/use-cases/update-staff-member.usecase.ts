import { Injectable } from "@nestjs/common";
import { AuditAction, StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../domain/constants";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../domain/repositories/user.repository";
import { UpdateStaffMemberInput } from "../../interfaces/http/validations/update-staff-member.validation";

/** The part of an edit that changes what somebody may do, as opposed to who they are. */
type AccessChange = Pick<UpdateStaffMemberInput, "role" | "isActive" | "branchIds">;

@Injectable()
export class UpdateStaffMemberUsecase {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly userRepository: UserRepository,
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

    const { name, phone, avatarUrl, ...access } = dto;
    const details = { name, phone, avatarUrl };
    const editsDetails = Object.values(details).some(value => value !== undefined);
    if (editsDetails) await this.guardDetails(member, phone);

    await this.guardLastOwner(member, access);

    // Reactivating somebody takes a seat again, so it is held to the plan like adding a new one.
    if (dto.isActive === true && !member.isActive) {
      await this.entitlementService.assertCanCreate("seat", authEntity.restaurantId);
    }

    const branchIds = await this.resolveBranchIds(member, access, authEntity);
    const updated = editsDetails
      ? // One transaction, so a half-saved edit (new name, old role) cannot be left behind.
        await this.userRepository.$transaction(async tx => {
          await this.userRepository.update(
            member.userId,
            {
              ...(name !== undefined && { name }),
              ...(phone !== undefined && { phone }),
              ...(avatarUrl !== undefined && { avatarUrl }),
            },
            tx
          );
          const changesAccess = Object.values(access).some(value => value !== undefined);
          return changesAccess
            ? this.restaurantMemberRepository.update(id, { ...access, branchIds }, tx)
            : ((await this.restaurantMemberRepository.findById(id, { tx })) ?? member);
        })
      : await this.restaurantMemberRepository.update(id, { ...access, branchIds });

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
   * A name, phone or photo belongs to the person's account, which is shared by every restaurant they work at, so
   * one owner must not rewrite it for the others. The number must also stay unique across accounts.
   */
  private async guardDetails(member: IStaffMember, phone: string | null | undefined): Promise<void> {
    const memberships = await this.restaurantMemberRepository.findActiveByUserId(member.userId);
    if (memberships.some(other => other.restaurantId !== member.restaurantId)) {
      throw new ForbiddenException(STAFF_MEMBER_ERROR_MESSAGES.SHARED_ACCOUNT);
    }
    if (phone) {
      const owner = await this.userRepository.findByPhone(phone);
      if (owner && owner.id !== member.userId) throw new ConflictException(AUTH_ERROR_MESSAGES.PHONE_TAKEN);
    }
  }

  /**
   * Explicit ids are validated against this restaurant. Demoting an OWNER (who needed no assignments)
   * without saying where they work would lock them out at sign-in, so they land in the editor's branch.
   */
  private async resolveBranchIds(member: IStaffMember, dto: AccessChange, authEntity: AuthEntity): Promise<string[] | undefined> {
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
  private async guardLastOwner(member: IStaffMember, dto: AccessChange): Promise<void> {
    const losingOwner = member.role === StaffRole.OWNER && (dto.isActive === false || (dto.role && dto.role !== StaffRole.OWNER));
    if (!losingOwner) return;

    const activeOwners = await this.restaurantMemberRepository.countActiveByRole(member.restaurantId, StaffRole.OWNER);
    if (activeOwners <= 1) throw new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.LAST_OWNER);
  }
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(id => b.includes(id));
}
