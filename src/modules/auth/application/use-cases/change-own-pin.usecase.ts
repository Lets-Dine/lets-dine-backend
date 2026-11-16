import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { BadRequestException, UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { hashPin, verifyPin } from "../../../users/domain/utils/pin.util";
import { ChangeOwnPinInput } from "../../interfaces/http/validations/change-own-pin.validation";

@Injectable()
export class ChangeOwnPinUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(dto: ChangeOwnPinInput, authEntity: AuthEntity): Promise<void> {
    const user = await this.userRepository.findByEmail(authEntity.email);
    if (!user || user.id !== authEntity.sub || !user.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);
    if (!(await verifyPin(dto.currentPin, user.pinHash))) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.WRONG_CURRENT_PIN);

    // The approval PIN is typed at other people's tills: if it were also the sign-in PIN, seeing it there would open the account.
    if (user.approvalPinHash && (await verifyPin(dto.newPin, user.approvalPinHash))) throw new BadRequestException(AUTH_ERROR_MESSAGES.PIN_IS_APPROVAL_PIN);

    await this.userRepository.update(user.id, { pinHash: await hashPin(dto.newPin) });
  }
}
