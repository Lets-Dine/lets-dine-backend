import { KitchenStation, OrderItemStatus, OrderType } from "@prisma/client";

export interface IKitchenTicketLine {
  id: string;
  ticketId: string;
  /** Null once the line was removed after being cooked — history only. */
  orderItemId: string | null;
  /** Positive = make this many; negative = stop making this many (a void). */
  qtyDelta: number;
  dishNameSnapshot: string;
  variantNameSnapshot: string | null;
  addOnNames: string[];
  notes: string;
  /** Where the order line behind this ticket line stands now — null once it was removed. Absent on a just-created ticket. */
  itemStatus?: OrderItemStatus | null;
}

/** Where the food goes, so a pass can show "Table 4" without a second lookup. */
export interface IKitchenTicketOrder {
  reference: string;
  orderType: OrderType;
  tableName: string | null;
  floorName: string | null;
  floorVisitorName: string | null;
}

export interface IKitchenTicket {
  id: string;
  branchId: string;
  orderId: string;
  station: KitchenStation;
  number: number;
  createdAt: Date;
  acknowledgedAt: Date | null;
  printedAt: Date | null;
  warningDismissedAt?: Date | null;
  lines: IKitchenTicketLine[];
  order?: IKitchenTicketOrder;
  /** Only on the "not confirmed" list: waiting on a person at a screen, or on a printer to print it. */
  unconfirmed?: "screen" | "printer";
}
