import { KitchenStation } from "@prisma/client";

export interface RoutablePrinter {
  id: string;
  fullKot: boolean;
  stations: KitchenStation[];
  tableAssignment: boolean;
  tableIds: string[];
  floorIds: string[];
}

export interface RoutableTicket {
  id: string;
  station: KitchenStation;
}

export interface PrintJobDraft {
  printerId: string;
  ticketIds: string[];
}

/**
 * Which printer prints what, for the tickets one order change just produced.
 *
 * - A full-KOT printer gets every ticket together, as one slip.
 * - Any other printer gets only the tickets of its own stations, one slip each.
 * - With table assignment on, a printer only serves orders for its tables or floors. A delivery order
 *   has neither, so it never matches one; and ticking nothing means the printer serves nothing.
 */
export function routePrintJobs(
  tickets: RoutableTicket[],
  order: { tableId: string | null; floorId: string | null },
  printers: RoutablePrinter[]
): PrintJobDraft[] {
  const jobs: PrintJobDraft[] = [];
  for (const printer of printers) {
    if (printer.tableAssignment) {
      const atTable = order.tableId !== null && printer.tableIds.includes(order.tableId);
      const onFloor = order.floorId !== null && printer.floorIds.includes(order.floorId);
      if (!atTable && !onFloor) continue;
    }
    if (printer.fullKot) {
      if (tickets.length) jobs.push({ printerId: printer.id, ticketIds: tickets.map(ticket => ticket.id) });
      continue;
    }
    for (const ticket of tickets) {
      if (printer.stations.includes(ticket.station)) jobs.push({ printerId: printer.id, ticketIds: [ticket.id] });
    }
  }
  return jobs;
}
