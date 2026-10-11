import { Injectable } from "@nestjs/common";
import { AuditAction, DeliveryAccountKind, DeliverySettlementDirection } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../ledger/domain/repositories/ledger.repository";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliverySettlement } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { accountBalance, settlementProblem } from "../../domain/utils/delivery-balance.util";
import { ledgerPostingsFor } from "../../domain/utils/delivery-ledger.util";
import { RecordSettlementInput } from "../../interfaces/http/validations/record-settlement.validation";

/**
 * Pays a courier account what the branch owes it in fees — all of it or part, now or long after the
 * deliveries — and posts it to the cash book as an expense. The books must stay honest: a payout cannot
 * be more than is owed. A partner's rider has no account of their own.
 *
 * The same transaction posts the money to the cash book — a collection is cash coming in, a payout is a
 * fee going out — so the delivery books and the drawer can never disagree about a settlement.
 */
@Injectable()
export class RecordSettlementUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: RecordSettlementInput, authEntity: AuthEntity): Promise<IDeliverySettlement> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };

    // A courier's cash comes in when each order is settled (`SettleDeliveryOrderUsecase`), where it is booked as the
    // order's payment. What is left to settle on its own is the fees the branch owes, paid in full or in part.
    if (dto.direction === DeliverySettlementDirection.COLLECT) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.COLLECT_AT_ORDER);
    if (dto.offset > 0) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.NO_NETTING);

    const account =
      dto.accountKind === DeliveryAccountKind.PARTNER
        ? await this.deliveryRepository.findPartner(dto.accountId)
        : await this.deliveryRepository.findRider(dto.accountId);
    if (!account || !isInActiveBranch(authEntity, account)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    if (dto.accountKind === DeliveryAccountKind.RIDER && (account as { partnerId: string | null }).partnerId)
      throw new BadRequestException(DELIVERY_ERROR_MESSAGES.ACCOUNT_VIA_PARTNER);

    // ponytail: two managers settling the same account at once could both pass the check; add a per-account lock if that happens.
    return this.deliveryRepository.$transaction(async tx => {
      const totals = await this.deliveryRepository.sumAccount(scope, { kind: dto.accountKind, id: dto.accountId }, { tx });
      const problem = settlementProblem(accountBalance(totals), dto.direction, dto.amount, dto.offset);
      if (problem) throw new ConflictException(problem);

      const settlement = await this.deliveryRepository.createSettlement(
        { ...scope, ...dto, createdBy: authEntity.sub, createdByName: authEntity.name },
        { tx }
      );
      const courierName = (account as { name: string }).name;
      for (const posting of ledgerPostingsFor(settlement)) {
        await this.ledgerRepository.createExpense(
          {
            ...scope,
            ...posting,
            note: `${courierName}${dto.note ? ` · ${dto.note}` : ""}`,
            createdBy: authEntity.sub,
            createdByName: authEntity.name,
            deliverySettlementId: settlement.id,
          },
          { tx }
        );
      }
      const verb = dto.direction === DeliverySettlementDirection.COLLECT ? "Collected" : "Paid out";
      await this.auditLogService.record(
        {
          action: AuditAction.delivery_settled,
          subject: courierName,
          detail: `${verb} ${dto.amount}${dto.offset > 0 ? ` and netted off ${dto.offset}` : ""} (${dto.method.toLowerCase()})`,
        },
        authEntity,
        tx
      );
      return settlement;
    });
  }
}
