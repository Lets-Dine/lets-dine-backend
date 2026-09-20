import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

/**
 * The till: close every open order on a table in one motion once the guest
 * has paid. There is no separate ledger — an order's status *is* its payment
 * state — so settling is just fast-forwarding every open order on this table
 * to COMPLETED at once.
 */
@Injectable()
export class SettleTableUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(tableId: string, authEntity: AuthEntity): Promise<IOrderWithItems[]> {
    const table = await this.diningTableRepository.findById(tableId);
    if (!table || table.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND);
    }

    return this.orderRepository.$transaction(async tx => {
      const settled = await this.orderRepository.settleOpenByTableId(tableId, authEntity.restaurantId, { tx });
      if (settled.length === 0) throw new ConflictException(ORDER_ERROR_MESSAGES.NO_OPEN_ORDERS);

      const total = settled.reduce((sum, order) => sum + order.total, 0);
      await this.auditLogService.record(
        {
          action: AuditAction.table_settled,
          subject: table.name,
          detail: `${settled.length} order${settled.length === 1 ? "" : "s"} settled — ${total} ${settled[0].currency}`,
        },
        authEntity,
        tx
      );

      return settled;
    });
  }
}
