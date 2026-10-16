import { Module } from "@nestjs/common";
import { GetTransactionSummaryUsecase } from "./application/use-cases/get-transaction-summary.usecase";
import { ListTransactionsUsecase } from "./application/use-cases/list-transactions.usecase";
import { TransactionRepository } from "./domain/repositories/transaction.repository";
import TransactionRepositoryImpl from "./infrastructure/repositories/transaction.repository.impl";
import { TransactionController } from "./interfaces/http/transaction.controller";

@Module({
  controllers: [TransactionController],
  providers: [
    ListTransactionsUsecase,
    GetTransactionSummaryUsecase,
    TransactionRepositoryImpl,
    { provide: TransactionRepository, useExisting: TransactionRepositoryImpl },
  ],
})
export class TransactionsModule {}
