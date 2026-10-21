import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { ILedgerEntry } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { FetchLedgerEntriesQuery } from "../../interfaces/http/validations/fetch-ledger-entries.validation";

/**
 * The open period as one tape: the opening float, then every sale and expense in the order it happened.
 * With `from`/`to` it reads that window instead (a past close, a chosen day) — no opening line, the caller knows its own base.
 */
@Injectable()
export class GetLedgerEntriesUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(authEntity: AuthEntity, { from, to }: FetchLedgerEntriesQuery = {}): Promise<ILedgerEntry[]> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const history = Boolean(from || to);
    const last = history ? null : await this.ledgerRepository.findLastClose(scope);
    if (!history && !last) return [];

    const [sales, expenses] = await Promise.all([
      this.ledgerRepository.fetchSales(scope, last?.closedAt ?? from ?? null, to),
      this.ledgerRepository.fetchAllExpenses(scope, last?.closedAt ?? from ?? null, to),
    ]);

    const entries: ILedgerEntry[] = [
      ...(last
        ? [
            {
              id: last.id,
              kind: "opening" as const,
              at: last.closedAt,
              amount: last.closingCounted + last.bankCounted,
              method: "CASH" as const,
              cashDelta: last.closingCounted,
              bankDelta: last.bankCounted,
              label: "Day opened",
              detail: last.closedByName ?? "",
              sourceType: "CLOSE" as const,
              sourceId: last.id,
              reference: "",
            },
          ]
        : []),
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
          sourceType: "PAYMENT",
          sourceId: sale.paymentId,
          reference: sale.reference,
        })
      ),
      ...expenses.map((expense): ILedgerEntry => {
        const toBank = expense.kind === "DEPOSIT";
        const transfer = toBank || expense.kind === "WITHDRAWAL";
        const sign = expense.kind === "EXPENSE" ? -1 : 1;
        const onCash = expense.method === "CASH";
        return {
          id: expense.id,
          kind: transfer ? "transfer" : expense.kind === "INCOME" ? "income" : expense.paymentRefundId ? "refund" : "expense",
          at: expense.createdAt,
          amount: expense.amount,
          method: expense.method,
          // A transfer shifts money from one side to the other; anything else lands on the side it was paid with.
          cashDelta: transfer ? (toBank ? -expense.amount : expense.amount) : onCash ? sign * expense.amount : 0,
          bankDelta: transfer ? (toBank ? expense.amount : -expense.amount) : onCash ? 0 : sign * expense.amount,
          label: transfer ? (toBank ? "Drawer → Bank" : "Bank → Drawer") : expense.category,
          detail: [expense.kind === "INCOME" ? "Income" : "", expense.note, expense.createdByName].filter(Boolean).join(" · "),
          locked: expense.deliverySettlementId !== null || expense.supplierPaymentId !== null || expense.paymentRefundId !== null || expense.recurringExpenseId !== null,
          // Classified by which record posted the row (its link), so a supplier payment is never mistaken for a plain expense.
          ...(expense.paymentRefundId
            ? { sourceType: "REFUND" as const, sourceId: expense.paymentRefundId }
            : expense.supplierPaymentId
              ? { sourceType: "SUPPLIER_PAYMENT" as const, sourceId: expense.supplierPaymentId }
              : expense.deliverySettlementId
                ? { sourceType: "DELIVERY_SETTLEMENT" as const, sourceId: expense.deliverySettlementId }
                : {
                    sourceType: transfer ? ("TRANSFER" as const) : expense.kind === "INCOME" ? ("INCOME" as const) : ("EXPENSE" as const),
                    sourceId: expense.id,
                  }),
          reference: "",
        };
      }),
    ];

    return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
