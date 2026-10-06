import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { ICashClose } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";

/**
 * Takes the latest close back. A period is everything after the previous close, so deleting the
 * latest one reopens the period before it — and whatever was recorded since folds into it, with
 * nothing to move. The opening setup is never a close and can't be removed.
 */
@Injectable()
export class ReopenLedgerUsecase {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(authEntity: AuthEntity): Promise<ICashClose> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };

    return this.ledgerRepository.$transaction(async tx => {
      const last = await this.ledgerRepository.findLastClose(scope, { tx });
      if (!last || (await this.ledgerRepository.countCloses(scope, { tx })) <= 1)
        throw new ConflictException(LEDGER_ERROR_MESSAGES.NOTHING_TO_REOPEN);

      await this.ledgerRepository.deleteClose(last.id, { tx });
      await this.auditLogService.record(
        {
          action: AuditAction.ledger_reopened,
          subject: "Cash book",
          detail: `Reopened the close of ${last.closedAt.toISOString()} (drawer ${last.closingCounted}, bank ${last.bankCounted}, closed by ${last.closedByName ?? "unknown"})`,
        },
        authEntity,
        tx
      );
      return last;
    });
  }
}
