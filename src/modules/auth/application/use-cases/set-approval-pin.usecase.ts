import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { can } from "../../../../common/auth";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { hashPin, verifyPin } from "../../../users/domain/utils/pin.util";
import { SetApprovalPinInput } from "../../interfaces/http/validations/set-approval-pin.validation";

/**
 * The PIN a manager or owner approves a discount or a changed bill with. A second PIN, never the sign-in one: it is typed on the
 * cashier's screen, so it must not open anybody's account if it is seen. Setting it asks for the sign-in PIN, so a signed-in
 * device left unattended cannot be used to put a PIN of its own in.
 */
@Injectable()
export class SetApprovalPinUsecase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: SetApprovalPinInput, authEntity: AuthEntity): Promise<void> {
    if (!can(authEntity.role, "payments:discount")) throw new ForbiddenException(AUTH_ERROR_MESSAGES.APPROVAL_PIN_NOT_FOR_ROLE);

    const user = await this.userRepository.findByEmail(authEntity.email);
    if (!user || user.id !== authEntity.sub || !user.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);
    if (!(await verifyPin(dto.currentPin, user.pinHash))) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.WRONG_CURRENT_PIN);
    if (await verifyPin(dto.approvalPin, user.pinHash)) throw new BadRequestException(AUTH_ERROR_MESSAGES.APPROVAL_PIN_SAME_AS_SIGN_IN);

    const approvalPinHash = await hashPin(dto.approvalPin);
    // Together: a changed PIN with no record of it, or a record of a change that did not happen, is worse than neither.
    await this.userRepository.$transaction(async tx => {
      await this.userRepository.update(user.id, { approvalPinHash }, tx);
      await this.auditLogService.record({ action: AuditAction.approval_pin_changed, subject: authEntity.name, detail: "Approval PIN set" }, authEntity, tx);
    });
  }
}
