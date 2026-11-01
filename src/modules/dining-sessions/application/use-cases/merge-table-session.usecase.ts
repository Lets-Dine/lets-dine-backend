import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuditAction } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../tables/domain/constants";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";

/**
 * Moves a table's visit to another table. If the other table is empty the visit just changes tables; if it
 * already has a visit, the two become one bill — the source's orders join the target's session and the source
 * table is freed. Neither visit may have been paid, even in part: a payment is tied to the session it was taken
 * on, so merging after one would leave a bill that no longer matches the orders on it.
 */
@Injectable()
export class MergeTableSessionUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(sourceTableId: string, targetTableId: string, authEntity: AuthEntity): Promise<IDiningTable> {
    if (sourceTableId === targetTableId) throw new BadRequestException(DINING_SESSION_ERROR_MESSAGES.MERGE_SAME_TABLE);

    const [source, target] = await Promise.all([
      this.diningTableRepository.findById(sourceTableId),
      this.diningTableRepository.findById(targetTableId),
    ]);
    if (!source || !target || !isInActiveBranch(authEntity, source) || source.branchId !== target.branchId) {
      throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);
    }
    if (!target.isActive) throw new ConflictException(DINING_TABLE_ERROR_MESSAGES.INACTIVE);

    return this.diningTableRepository.$transaction(async tx => {
      // Always in id order, so two staff merging the same pair from opposite ends cannot deadlock.
      for (const id of [source.id, target.id].sort()) await this.diningTableRepository.lockById(id, { tx });

      const from = await this.diningSessionRepository.findOpenByTableId(source.id, { tx });
      if (!from) throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.NO_ACTIVE_SESSION);
      const into = await this.diningSessionRepository.findOpenByTableId(target.id, { tx });

      if (
        (await this.diningSessionRepository.hasPayments(from.id, { tx })) ||
        (into && (await this.diningSessionRepository.hasPayments(into.id, { tx })))
      ) {
        throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.MERGE_HAS_PAYMENTS);
      }

      let updated: IDiningTable;
      if (into) {
        await this.orderRepository.moveToSession(from.id, { sessionId: into.id, tableId: target.id }, { tx });
        const ended = await this.diningSessionRepository.update(
          from.id,
          { endedAt: new Date(), waiterCalledAt: null, billRequestedAt: null },
          tx
        );
        await this.diningTableRepository.update(source.id, { currentSessionId: null }, { tx, actorId: authEntity.sub });
        updated = (await this.diningTableRepository.findById(target.id, { tx })) as IDiningTable;
        this.eventEmitter.emit("session.ended", ended);
      } else {
        await this.diningSessionRepository.update(from.id, { tableId: target.id }, tx);
        await this.orderRepository.moveToSession(from.id, { sessionId: from.id, tableId: target.id }, { tx });
        await this.diningTableRepository.update(source.id, { currentSessionId: null }, { tx, actorId: authEntity.sub });
        updated = await this.diningTableRepository.update(target.id, { currentSessionId: from.id }, { tx, actorId: authEntity.sub });
      }

      await this.auditLogService.record(
        { action: AuditAction.table_merged, subject: source.name, detail: into ? `Merged into ${target.name}` : `Moved to ${target.name}` },
        authEntity,
        tx
      );
      for (const order of await this.orderRepository.findOpenBySessionId(into?.id ?? from.id, authEntity.restaurantId, { tx })) {
        this.eventEmitter.emit("order.updated", order);
      }
      return updated;
    });
  }
}
