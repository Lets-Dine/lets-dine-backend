import { Injectable } from "@nestjs/common";
import { KitchenStation, OrderType } from "@prisma/client";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { IKitchenTicketCreate, KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { OPEN_ORDER_STATUSES } from "../../domain/utils/order-status.util";
import { SentLine } from "../../domain/utils/ticket-delta.util";

const TICKET_INCLUDE = {
  lines: true,
  order: {
    select: {
      reference: true,
      orderType: true,
      floorVisitorName: true,
      table: { select: { name: true } },
      floor: { select: { name: true } },
    },
  },
};

@Injectable()
class KitchenTicketRepositoryImpl implements KitchenTicketRepository {
  constructor(private prisma: PrismaService) {}

  async findSentLines(orderId: string, options?: { tx?: PrismaTransaction }): Promise<SentLine[]> {
    const prisma = options?.tx ?? this.prisma;
    const lines = await prisma.kitchenTicketLine.findMany({
      where: { ticket: { orderId }, orderItemId: { not: null } },
      include: { ticket: { select: { station: true } } },
      orderBy: { ticket: { number: "asc" } },
    });
    return lines.map(({ ticket, orderItemId, ...line }) => ({ ...line, orderItemId: orderItemId as string, station: ticket.station }));
  }

  async findOpenByBranch(branchId: string, station: KitchenStation, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket[]> {
    const prisma = options?.tx ?? this.prisma;
    const rows = await prisma.kitchenTicket.findMany({
      where: { branchId, station, order: { status: { in: OPEN_ORDER_STATUSES } } },
      include: TICKET_INCLUDE,
      orderBy: { number: "asc" },
    });
    return this.hydrate(prisma, rows);
  }

  async findUnacknowledged(
    branchId: string,
    stations: KitchenStation[],
    alsoTicketIds: string[],
    options?: { tx?: PrismaTransaction }
  ): Promise<IKitchenTicket[]> {
    if (stations.length === 0 && alsoTicketIds.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    const rows = await prisma.kitchenTicket.findMany({
      where: {
        branchId,
        acknowledgedAt: null,
        printedAt: null,
        warningDismissedAt: null,
        order: { status: { in: OPEN_ORDER_STATUSES } },
        OR: [{ station: { in: stations } }, { id: { in: alsoTicketIds } }],
      },
      include: TICKET_INCLUDE,
      orderBy: { number: "asc" },
    });
    return this.hydrate(prisma, rows);
  }

  async findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket | null> {
    const prisma = options?.tx ?? this.prisma;
    const row = await prisma.kitchenTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    return row ? (await this.hydrate(prisma, [row]))[0] : null;
  }

  async findManyByIds(ids: string[], options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket[]> {
    if (ids.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    const rows = await prisma.kitchenTicket.findMany({ where: { id: { in: ids } }, include: TICKET_INCLUDE, orderBy: { number: "asc" } });
    return this.hydrate(prisma, rows);
  }

  async markPrintedMany(ids: string[], at: Date, options?: { tx?: PrismaTransaction }): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.kitchenTicket.updateMany({ where: { id: { in: ids }, printedAt: null }, data: { printedAt: at } });
  }

  async dismissWarning(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<void> {
    await (options?.tx ?? this.prisma).kitchenTicket.updateMany({
      where: { id, warningDismissedAt: null },
      data: { warningDismissedAt: at },
    });
  }

  async acknowledge(id: string, at: Date, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.kitchenTicket.updateMany({ where: { id, acknowledgedAt: null }, data: { acknowledgedAt: at } });
    const row = await prisma.kitchenTicket.findUniqueOrThrow({ where: { id }, include: TICKET_INCLUDE });
    return (await this.hydrate(prisma, [row]))[0];
  }

  /** Lines carry no foreign key to the order line (it may be deleted), so its current status is read here. */
  private async hydrate(prisma: PrismaService | PrismaTransaction, rows: Parameters<typeof toTicket>[0][]): Promise<IKitchenTicket[]> {
    const ids = [...new Set(rows.flatMap(row => row.lines.map(line => line.orderItemId)).filter((id): id is string => Boolean(id)))];
    const items = ids.length ? await prisma.orderItem.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } }) : [];
    const statusOf = new Map(items.map(item => [item.id, item.status]));
    return rows.map(row =>
      toTicket({
        ...row,
        lines: row.lines.map(line => ({ ...line, itemStatus: line.orderItemId ? (statusOf.get(line.orderItemId) ?? null) : null })),
      })
    );
  }

  async detachItem(orderItemId: string, options?: { tx?: PrismaTransaction }): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.kitchenTicketLine.updateMany({ where: { orderItemId }, data: { orderItemId: null } });
  }

  async create(data: IKitchenTicketCreate, options?: { tx?: PrismaTransaction }): Promise<IKitchenTicket> {
    const prisma = options?.tx ?? this.prisma;
    // The increment row-locks the branch for the rest of the transaction, so two orders
    // can't draw the same number. ponytail: never resets, add a daily reset if kitchens ask.
    const { ticketSeq } = await prisma.branch.update({
      where: { id: data.branchId },
      data: { ticketSeq: { increment: 1 } },
      select: { ticketSeq: true },
    });
    return prisma.kitchenTicket.create({
      data: {
        branchId: data.branchId,
        orderId: data.orderId,
        station: data.station,
        number: ticketSeq,
        lines: { create: data.lines },
      },
      include: { lines: true },
    });
  }
}

function toTicket(
  row: {
    order: {
      reference: string;
      orderType: OrderType;
      floorVisitorName: string | null;
      table: { name: string } | null;
      floor: { name: string } | null;
    };
  } & Omit<IKitchenTicket, "order">
): IKitchenTicket {
  const { order, ...ticket } = row;
  return {
    ...ticket,
    order: {
      reference: order.reference,
      orderType: order.orderType,
      tableName: order.table?.name ?? null,
      floorName: order.floor?.name ?? null,
      floorVisitorName: order.floorVisitorName,
    },
  };
}

export default KitchenTicketRepositoryImpl;
