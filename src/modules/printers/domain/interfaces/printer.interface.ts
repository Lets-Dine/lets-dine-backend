import { KitchenStation, PaperWidth, PrinterLink } from "@prisma/client";

export interface IPrinter {
  id: string;
  branchId: string;
  name: string;
  paperWidth: PaperWidth;
  /** Empty when `link` is BLUETOOTH. */
  ipAddress: string;
  port: number;
  link: PrinterLink;
  /** OS printer name or serial port. Empty for a network printer. */
  deviceName: string;
  serial: boolean;
  /** The whole order on one slip, every station together. Overrides `stations`. */
  fullKot: boolean;
  /** KITCHEN = KOT, BAR = BOT. */
  stations: KitchenStation[];
  /** When on, only the tables and floors below print here. */
  tableAssignment: boolean;
  tableIds: string[];
  floorIds: string[];
  isActive: boolean;
  /** Warn the front of house when a slip for this printer sits unprinted. */
  warnIfUnprinted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
