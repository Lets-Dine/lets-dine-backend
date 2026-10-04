import { Injectable } from "@nestjs/common";
import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../domain/constants";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../domain/repositories/user.repository";
import { hashPin } from "../../domain/utils/pin.util";
import { CreateStaffMemberInput } from "../../interfaces/http/validations/create-staff-member.validation";

/**
 * Adds somebody to this restaurant's team. A person who already has an account
 * (they work at another restaurant on the platform) keeps it — only the
 * membership is new.
 */
@Injectable()
export class CreateStaffMemberUsecase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly auditLogService: AuditLogService,
    private readonly branchRepository: BranchRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  async execute(dto: CreateStaffMemberInput, authEntity: AuthEntity): Promise<IStaffMember> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      const existingMember = await this.restaurantMemberRepository.findByUserAndRestaurant(existingUser.id, authEntity.restaurantId);
      if (existingMember) throw new ConflictException(STAFF_MEMBER_ERROR_MESSAGES.ALREADY_EXISTS);
    }

    await this.entitlementService.assertCanCreate("seat", authEntity.restaurantId);

    const branchIds = await this.resolveBranchIds(dto, authEntity);
    const pinHash = await hashPin(dto.pin);

    const member = await this.userRepository.$transaction(async tx => {
      const user =
        existingUser ?? (await this.userRepository.create({ email: dto.email, name: dto.name, pinHash }, { tx, actorId: authEntity.sub }));

      return this.restaurantMemberRepository.create(
        { userId: user.id, restaurantId: authEntity.restaurantId, role: dto.role, branchIds },
        { tx }
      );
    });

    await this.auditLogService.record(
      { action: AuditAction.staff_invited, subject: member.name, detail: `Added as ${member.role}` },
      authEntity
    );

    return member;
  }

  /** An OWNER reaches every branch and needs no rows; anybody else must be pinned to at least one. */
  private async resolveBranchIds(dto: CreateStaffMemberInput, authEntity: AuthEntity): Promise<string[] | undefined> {
    if (dto.role === StaffRole.OWNER) return undefined;

    const requested = [...new Set(dto.branchIds ?? [authEntity.branchId])];
    const valid = await this.branchRepository.findActiveByIds(authEntity.restaurantId, requested);
    if (valid.length !== requested.length) throw new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.INVALID_BRANCHES);
    return requested;
  }
}
