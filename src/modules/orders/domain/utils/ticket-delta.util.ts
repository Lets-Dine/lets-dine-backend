import { KitchenStation, OrderItemStatus } from "@prisma/client";

interface LineSnapshot {
  dishNameSnapshot: string;
  variantNameSnapshot: string | null;
  addOnNames: string[];
  notes: string;
}

/** A line the pass has already been told about (from `KitchenTicketLine`, with its ticket's station). */
export interface SentLine extends LineSnapshot {
  orderItemId: string;
  qtyDelta: number;
  station: KitchenStation;
}

/** An order line as it stands now, with the station of its dish. */
export interface CurrentItem extends LineSnapshot {
  id: string;
  quantity: number;
  status: OrderItemStatus;
  station: KitchenStation;
}

export interface TicketLineDraft extends LineSnapshot {
  orderItemId: string;
  station: KitchenStation;
  qtyDelta: number;
}

/**
 * What the pass still has to be told so that what it has been sent matches the order:
 * +n for new or added quantity, -n for removed or cancelled quantity. Empty when nothing
 * changed, so it is safe to run after every order edit.
 *
 * A READY/SERVED line is already cooked — never voided. A line that no longer exists
 * (removed down to zero) is voided from its earlier lines' snapshots, on the station
 * that first received it.
 */
export function diffTicketLines(items: CurrentItem[], sent: SentLine[]): TicketLineDraft[] {
  const sentByItem = new Map<string, { qty: number; first: SentLine }>();
  for (const line of sent) {
    const entry = sentByItem.get(line.orderItemId) ?? { qty: 0, first: line };
    entry.qty += line.qtyDelta;
    sentByItem.set(line.orderItemId, entry);
  }

  const drafts: TicketLineDraft[] = [];
  for (const item of items) {
    const prior = sentByItem.get(item.id);
    const have = prior?.qty ?? 0;
    sentByItem.delete(item.id);
    const cooked = item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED;
    const want = item.status === OrderItemStatus.CANCELLED ? 0 : cooked ? have : item.quantity;
    if (want === have) continue;
    drafts.push({
      orderItemId: item.id,
      // Stay on the pass that first got this line, even if the dish was reassigned since.
      station: prior?.first.station ?? item.station,
      qtyDelta: want - have,
      dishNameSnapshot: item.dishNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
      addOnNames: item.addOnNames,
      notes: item.notes,
    });
  }

  for (const [orderItemId, { qty, first }] of sentByItem) {
    if (qty <= 0) continue;
    drafts.push({
      orderItemId,
      station: first.station,
      qtyDelta: -qty,
      dishNameSnapshot: first.dishNameSnapshot,
      variantNameSnapshot: first.variantNameSnapshot,
      addOnNames: first.addOnNames,
      notes: first.notes,
    });
  }
  return drafts;
}
