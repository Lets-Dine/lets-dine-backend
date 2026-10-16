import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { ITransaction } from "../../domain/interfaces/transaction.interface";
import { ITransactionFilter, TransactionRepository } from "../../domain/repositories/transaction.repository";
import { courierFeeTransactions } from "../../domain/utils/courier-fee-transactions.util";
import { purchaseTransactions } from "../../domain/utils/purchase-transactions.util";
import { FetchTransactionsQuery } from "../../interfaces/http/validations/fetch-transactions.validation";

/**
 * Every financial activity of the branch in one list, paid or not: sales, credit purchases, expenses,
 * income, transfers and refunds. Each row comes from the record that created it, so a sale is one row
 * whether it is unpaid, split or settled later — and a payment never adds a row of its own.
 */
@Injectable()
export class ListTransactionsUsecase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(query: FetchTransactionsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<ITransaction>> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const { limit, offset, ...filter } = query satisfies ITransactionFilter & { limit: number; offset: number };
    const take = offset + limit;
    const wants = (...types: string[]) => !query.type || types.includes(query.type);

    // ponytail: each source returns its newest `offset + limit` rows and they are merged in memory; fine for page-by-page browsing, move to a SQL union view if deep paging gets slow.
    const [sales, expenses, refunds, credit, couriers] = await Promise.all([
      wants("SALE") ? this.transactionRepository.fetchSales(scope, filter, take) : { rows: [], count: 0 },
      wants("EXPENSE", "INCOME", "TRANSFER") ? this.transactionRepository.fetchExpenses(scope, filter, take) : { rows: [], count: 0 },
      wants("REFUND") ? this.transactionRepository.fetchRefunds(scope, filter, take) : { rows: [], count: 0 },
      wants("PURCHASE") ? this.transactionRepository.fetchCreditLots(scope) : { lots: [], settled: new Map<string, number>() },
      wants("DELIVERY_FEE") && !filter.customerId && !filter.supplier
        ? this.transactionRepository.fetchCourierRuns(scope)
        : { runs: [], settled: new Map<string, number>() },
    ]);

    const purchases = purchaseTransactions(credit.lots, credit.settled).filter(
      p =>
        (!filter.paymentStatus || p.paymentStatus === filter.paymentStatus) &&
        (!filter.outstandingOnly || p.outstandingAmount > 0) &&
        (!filter.supplier || p.counterparty?.name.toLowerCase() === filter.supplier.toLowerCase()) &&
        (!filter.category || p.category === filter.category) &&
        !filter.customerId &&
        (!filter.from || p.transactionDate >= filter.from) &&
        (!filter.to || p.transactionDate <= filter.to)
    );

    const fees = courierFeeTransactions(couriers.runs, couriers.settled).filter(
      f =>
        (!filter.paymentStatus || f.paymentStatus === filter.paymentStatus) &&
        (!filter.outstandingOnly || f.outstandingAmount > 0) &&
        (!filter.category || f.category === filter.category) &&
        (!filter.from || f.transactionDate >= filter.from) &&
        (!filter.to || f.transactionDate <= filter.to)
    );

    const merged = [...sales.rows, ...expenses.rows, ...refunds.rows, ...purchases, ...fees];
    merged.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime() || a.id.localeCompare(b.id));
    return {
      rows: merged.slice(offset, offset + limit),
      count: sales.count + expenses.count + refunds.count + purchases.length + fees.length,
    };
  }
}
