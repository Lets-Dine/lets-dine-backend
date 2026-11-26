import { Injectable } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { BadRequestException, UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { NotificationService } from "../../../notifications/application/notification.service";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { hashPin, verifyPin } from "../../../users/domain/utils/pin.util";
import { DeleteOwnAccountInput } from "../../interfaces/http/validations/delete-own-account.validation";

/**
 * Self-service account deletion for staff (Google Play account-deletion policy). The user row is kept but anonymised,
 * so sales, orders and audit records still point at a real id. Personal details are wiped and every membership is
 * deactivated, so the sign-in and any token already issued stop working.
 */
@Injectable()
export class DeleteOwnAccountUsecase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly notificationService: NotificationService
  ) {}

  async execute(dto: DeleteOwnAccountInput, authEntity: AuthEntity): Promise<void> {
    const user = await this.userRepository.findByEmail(authEntity.email);
    if (!user || user.id !== authEntity.sub || !user.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);
    if (!(await verifyPin(dto.pin, user.pinHash))) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.WRONG_CURRENT_PIN);

    const memberships = await this.restaurantMemberRepository.findActiveByUserId(user.id);

    // Deleting the only owner would leave a restaurant nobody can run or bill. They hand over ownership first.
    for (const membership of memberships) {
      if (membership.role !== StaffRole.OWNER) continue;
      const owners = await this.restaurantMemberRepository.countActiveByRole(membership.restaurantId, StaffRole.OWNER);
      if (owners <= 1) throw new BadRequestException(AUTH_ERROR_MESSAGES.SOLE_OWNER_CANNOT_DELETE);
    }

    // Done first: once the memberships are off, nothing ties these stored device tokens to a live account any more.
    await this.notificationService.removeAllForMembers(memberships.map(membership => membership.id));

    // Random, so nothing can sign in with the old PIN even if the active flag were ever flipped back by mistake.
    const unusablePinHash = await hashPin(randomUUID());

    await this.userRepository.$transaction(async tx => {
      for (const membership of memberships) {
        await this.restaurantMemberRepository.update(membership.id, { isActive: false }, tx);
      }

      await this.userRepository.update(
        user.id,
        {
          name: "Deleted user",
          email: `deleted-${user.id}@deleted.invalid`,
          emailKey: null,
          phone: null,
          avatarUrl: null,
          pinHash: unusablePinHash,
          approvalPinHash: null,
          isActive: false,
        },
        tx
      );
    });
  }
}
