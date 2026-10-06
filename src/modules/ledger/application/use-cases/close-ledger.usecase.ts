import { Injectable } from "@nestjs/common";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { ICashClose } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { EMPTY_TOTALS, expectedBalances } from "../../domain/utils/ledger-balances.util";
import { CloseLedgerInput } from "../../interfaces/http/validations/close-ledger.validation";

/**
 * Ends the open period: freezes its totals against the counted cash. The first close of a branch
 * has no period behind it — it only records the opening drawer and bank balances, so sales made before the books
 * were started never count against the drawer.
 */
@Injectable()
export class CloseLedgerUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(dto: CloseLedgerInput, authEntity: AuthEntity): Promise<ICashClose> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const closedBy = { closedBy: authEntity.sub, closedByName: authEntity.name };

    // ponytail: two managers closing at the same instant could both build on one previous close; add a per-branch lock if that happens.
    return this.ledgerRepository.$transaction(async tx => {
      const last = await this.ledgerRepository.findLastClose(scope, { tx });
      const closedAt = new Date();
      if (last && (await this.ledgerRepository.countCloses(scope, { tx })) > 1) {
        const timeZone = await this.ledgerRepository.findBranchTimezone(authEntity.branchId);
        if (localDay(last.closedAt, timeZone) === localDay(closedAt, timeZone))
          throw new ConflictException(LEDGER_ERROR_MESSAGES.ALREADY_CLOSED_TODAY);
      }
      const totals = last ? await this.ledgerRepository.sumPeriod(scope, last.closedAt, closedAt, { tx }) : EMPTY_TOTALS;
      const opening = last?.closingCounted ?? dto.closingCounted;
      const bankOpening = last?.bankCounted ?? dto.bankCounted;
      const expected = expectedBalances(opening, bankOpening, totals);

      return this.ledgerRepository.createClose(
        {
          ...scope,
          ...totals,
          ...closedBy,
          opening,
          bankOpening,
          closingExpected: expected.cash,
          closingCounted: dto.closingCounted,
          variance: dto.closingCounted - expected.cash,
          bankExpected: expected.bank,
          bankCounted: dto.bankCounted,
          bankVariance: dto.bankCounted - expected.bank,
          note: dto.note,
          closedAt,
        },
        { tx }
      );
    });
  }
}
