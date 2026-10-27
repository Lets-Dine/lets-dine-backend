import { KitchenStation, PaperWidth } from "@prisma/client";

export interface IPrinter {
  id: string;
  branchId: string;
  name: string;
  paperWidth: PaperWidth;
  ipAddress: string;
  port: number;
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
