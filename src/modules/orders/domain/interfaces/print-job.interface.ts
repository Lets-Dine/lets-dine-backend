import { PaperWidth } from "@prisma/client";
import { IKitchenTicket } from "./kitchen-ticket.interface";

/** What the PC that prints needs: where to send it, and what to put on the slip. */
export interface IPrintJob {
  id: string;
  orderId: string;
  createdAt: Date;
  claimedAt: Date | null;
  attempts: number;
  lastError: string | null;
  printer: { id: string; name: string; ipAddress: string; port: number; paperWidth: PaperWidth };
  /** One ticket, or — for a full-KOT printer — every ticket one change produced. */
  tickets: IKitchenTicket[];
}
