import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ITransactionSummary } from "../../domain/interfaces/transaction.interface";
import { TransactionRepository } from "../../domain/repositories/transaction.repository";
import { courierFeeTransactions } from "../../domain/utils/courier-fee-transactions.util";
import { purchaseTransactions } from "../../domain/utils/purchase-transactions.util";

/** What customers owe the branch and what it owes suppliers — the receivable and payable totals. */
@Injectable()
export class GetTransactionSummaryUsecase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(authEntity: AuthEntity): Promise<ITransactionSummary> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const [receivables, credit, couriers] = await Promise.all([
      this.transactionRepository.sumReceivables(scope, new Date()),
      this.transactionRepository.fetchCreditLots(scope),
      this.transactionRepository.fetchCourierRuns(scope),
    ]);
    const unpaidFees = courierFeeTransactions(couriers.runs, couriers.settled).filter(f => f.outstandingAmount > 0);
    const open = purchaseTransactions(credit.lots, credit.settled).filter(p => p.outstandingAmount > 0);
    return {
      receivables,
      payables: { outstanding: open.reduce((sum, p) => sum + p.outstandingAmount, 0), count: open.length },
      courierFees: { outstanding: unpaidFees.reduce((sum, f) => sum + f.outstandingAmount, 0), count: unpaidFees.length },
    };
  }
}
