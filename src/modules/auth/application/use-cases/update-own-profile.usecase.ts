import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { ConflictException, UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { UpdateOwnProfileInput } from "../../interfaces/http/validations/update-own-profile.validation";

/** Name, phone and photo only: the email is the sign-in identity, and role/branches are the owner's to change. */
@Injectable()
export class UpdateOwnProfileUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(dto: UpdateOwnProfileInput, authEntity: AuthEntity): Promise<{ name: string; phone: string | null; avatarUrl: string | null }> {
    if (dto.phone) {
      const owner = await this.userRepository.findByPhone(dto.phone);
      if (owner && owner.id !== authEntity.sub) throw new ConflictException(AUTH_ERROR_MESSAGES.PHONE_TAKEN);
    }

    const existing = await this.userRepository.findById(authEntity.sub);
    if (!existing?.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const updated = await this.userRepository.update(authEntity.sub, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    });
    return { name: updated.name, phone: updated.phone, avatarUrl: updated.avatarUrl };
  }
}
