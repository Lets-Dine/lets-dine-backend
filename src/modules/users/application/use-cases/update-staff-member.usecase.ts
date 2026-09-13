import { Injectable } from "@nestjs/common";
import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../domain/constants";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../domain/repositories/restaurant-member.repository";
import { UpdateStaffMemberInput } from "../../interfaces/http/validations/update-staff-member.validation";

@Injectable()
export class UpdateStaffMemberUsecase {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateStaffMemberInput, authEntity: AuthEntity): Promise<IStaffMember> {
    const member = await this.restaurantMemberRepository.findById(id);
    if (!member || member.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(STAFF_MEMBER_ERROR_MESSAGES.NOT_FOUND);
    }

    if (member.id === authEntity.memberId) throw new ForbiddenException(STAFF_MEMBER_ERROR_MESSAGES.CANNOT_EDIT_SELF);

    await this.guardLastOwner(member, dto);

    const updated = await this.restaurantMemberRepository.update(id, dto);

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

  /** A restaurant with no active owner has nobody who can change its settings. */
  private async guardLastOwner(member: IStaffMember, dto: UpdateStaffMemberInput): Promise<void> {
    const losingOwner = member.role === StaffRole.OWNER && (dto.isActive === false || (dto.role && dto.role !== StaffRole.OWNER));
    if (!losingOwner) return;

    const activeOwners = await this.restaurantMemberRepository.countActiveByRole(member.restaurantId, StaffRole.OWNER);
    if (activeOwners <= 1) throw new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.LAST_OWNER);
  }
}
