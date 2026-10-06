import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ILedgerSummary } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { EMPTY_TOTALS, expectedBalances } from "../../domain/utils/ledger-balances.util";

/** The open period: opening cash and bank plus everything recorded since the last close. */
@Injectable()
export class GetLedgerSummaryUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(authEntity: AuthEntity): Promise<ILedgerSummary> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const last = await this.ledgerRepository.findLastClose(scope);
    const periodStart = last?.closedAt ?? null;
    const opening = last?.closingCounted ?? 0;
    const bankOpening = last?.bankCounted ?? 0;
    // Nothing is counted before the opening balances exist — the period has no start to sum from.
    const totals = last ? await this.ledgerRepository.sumPeriod(scope, periodStart, new Date()) : EMPTY_TOTALS;
    const closes = last ? await this.ledgerRepository.countCloses(scope) : 0;
    // The first close only sets the opening balances; it is not a day's close and can't be reopened.
    const realClose = closes > 1;
    const timeZone = last ? await this.ledgerRepository.findBranchTimezone(authEntity.branchId) : "";
    const closedToday = realClose && !!last && localDay(last.closedAt, timeZone) === localDay(new Date(), timeZone);
    const expected = expectedBalances(opening, bankOpening, totals);

    return {
      needsOpening: !last,
      periodStart,
      closedToday,
      canReopen: realClose,
      opening,
      bankOpening,
      ...totals,
      closingExpected: expected.cash,
      bankExpected: expected.bank,
    };
  }
}
