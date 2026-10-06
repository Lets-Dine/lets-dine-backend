import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ILedgerEntry } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";

/** The open period as one tape: the opening float, then every sale and expense in the order it happened. */
@Injectable()
export class GetLedgerEntriesUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(authEntity: AuthEntity): Promise<ILedgerEntry[]> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const last = await this.ledgerRepository.findLastClose(scope);
    if (!last) return [];

    const [sales, expenses] = await Promise.all([
      this.ledgerRepository.fetchSales(scope, last.closedAt),
      this.ledgerRepository.fetchAllExpenses(scope, last.closedAt),
    ]);

    const entries: ILedgerEntry[] = [
      {
        id: last.id,
        kind: "opening",
        at: last.closedAt,
        amount: last.closingCounted + last.bankCounted,
        method: "CASH",
        cashDelta: last.closingCounted,
        bankDelta: last.bankCounted,
        label: "Day opened",
        detail: last.closedByName ?? "",
      },
      ...sales.map(
        (sale): ILedgerEntry => ({
          id: sale.id,
          kind: "sale",
          at: sale.createdAt,
          amount: sale.total,
          method: sale.method,
          cashDelta: sale.method === "CASH" ? sale.total : 0,
          bankDelta: sale.method === "CASH" ? 0 : sale.total,
          label: sale.items.map(item => `${item.quantity}× ${item.dishNameSnapshot}`).join(", "),
          detail: sale.tableName ?? "Delivery",
        })
      ),
      ...expenses.map((expense): ILedgerEntry => {
        const toBank = expense.kind === "DEPOSIT";
        const transfer = toBank || expense.kind === "WITHDRAWAL";
        const sign = expense.kind === "EXPENSE" ? -1 : 1;
        const onCash = expense.method === "CASH";
        return {
          id: expense.id,
          kind: transfer ? "transfer" : expense.kind === "INCOME" ? "income" : "expense",
          at: expense.createdAt,
          amount: expense.amount,
          method: expense.method,
          // A transfer shifts money from one side to the other; anything else lands on the side it was paid with.
          cashDelta: transfer ? (toBank ? -expense.amount : expense.amount) : onCash ? sign * expense.amount : 0,
          bankDelta: transfer ? (toBank ? expense.amount : -expense.amount) : onCash ? 0 : sign * expense.amount,
          label: transfer ? (toBank ? "Drawer → Bank" : "Bank → Drawer") : expense.category,
          detail: [expense.kind === "INCOME" ? "Income" : "", expense.note, expense.createdByName].filter(Boolean).join(" · "),
        };
      }),
    ];

    return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
