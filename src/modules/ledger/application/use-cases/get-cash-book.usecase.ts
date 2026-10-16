import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ICashBook } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { EMPTY_TOTALS, expectedBalances } from "../../domain/utils/ledger-balances.util";
import { FetchLedgerEntriesQuery } from "../../interfaces/http/validations/fetch-ledger-entries.validation";
import { GetLedgerEntriesUsecase } from "./get-ledger-entries.usecase";

/**
 * The drawer and the bank over any window: what they held at `from`, what came in, went out and moved
 * between them, and what they hold at `to`. Rolled forward from the last cash-up at or before `from`, so
 * `opening + receipts − payments ± transfers = closing` always reconciles against the entries listed.
 * Only money that moved is in here — an unpaid sale or bill has no tender or expense row, so it adds nothing.
 */
@Injectable()
export class GetCashBookUsecase {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly getLedgerEntriesUsecase: GetLedgerEntriesUsecase
  ) {}

  async execute(authEntity: AuthEntity, { from, to }: Required<FetchLedgerEntriesQuery>): Promise<ICashBook> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const base = await this.ledgerRepository.findLastCloseAtOrBefore(scope, from);
    // Before the first cash-up there is no counted balance to start from: books open at zero.
    const sinceBase = base ? await this.ledgerRepository.sumPeriod(scope, base.closedAt, from) : EMPTY_TOTALS;
    const opening = expectedBalances(base?.closingCounted ?? 0, base?.bankCounted ?? 0, sinceBase);
    const t = await this.ledgerRepository.sumPeriod(scope, from, to);
    const expected = expectedBalances(opening.cash, opening.bank, t);
    // A cash-up inside the window replaces what the books expected with what was counted, and the next window opens from that count —
    // so the closing here must too. The gap is shown, never absorbed, so the statement still adds up line by line.
    const lastCloseInWindow = await this.ledgerRepository.findLastCloseAtOrBefore(scope, to);
    const closing =
      lastCloseInWindow && lastCloseInWindow.closedAt > from
        ? expectedBalances(
            lastCloseInWindow.closingCounted,
            lastCloseInWindow.bankCounted,
            await this.ledgerRepository.sumPeriod(scope, lastCloseInWindow.closedAt, to)
          )
        : expected;
    const entries = await this.getLedgerEntriesUsecase.execute(authEntity, { from, to });
    return {
      from,
      to,
      opening,
      receipts: { cash: t.cashSales + t.cashIncome, bank: t.cardSales + t.cardIncome },
      payments: { cash: t.cashExpenses, bank: t.cardExpenses },
      // Drawer → bank is `deposits`, bank → drawer `withdrawals`; neither is income or spend.
      transfers: { cashToBank: t.deposits, bankToCash: t.withdrawals },
      adjustment: { cash: closing.cash - expected.cash, bank: closing.bank - expected.bank },
      closing,
      entries,
    };
  }
}
