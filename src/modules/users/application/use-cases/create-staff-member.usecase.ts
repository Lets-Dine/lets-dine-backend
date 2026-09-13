import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
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
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateStaffMemberInput, authEntity: AuthEntity): Promise<IStaffMember> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      const existingMember = await this.restaurantMemberRepository.findByUserAndRestaurant(existingUser.id, authEntity.restaurantId);
      if (existingMember) throw new ConflictException(STAFF_MEMBER_ERROR_MESSAGES.ALREADY_EXISTS);
    }

    const pinHash = await hashPin(dto.pin);

    const member = await this.userRepository.$transaction(async tx => {
      const user =
        existingUser ?? (await this.userRepository.create({ email: dto.email, name: dto.name, pinHash }, { tx, actorId: authEntity.sub }));

      return this.restaurantMemberRepository.create({ userId: user.id, restaurantId: authEntity.restaurantId, role: dto.role }, { tx });
    });

    await this.auditLogService.record(
      { action: AuditAction.staff_invited, subject: member.name, detail: `Added as ${member.role}` },
      authEntity
    );

    return member;
  }
}
