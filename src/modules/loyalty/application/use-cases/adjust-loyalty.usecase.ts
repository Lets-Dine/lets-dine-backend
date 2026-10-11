import { Injectable } from "@nestjs/common";
import { AuditAction, LoyaltyEntryType } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LOYALTY_ERROR_MESSAGES } from "../../domain/constants";
import { ILoyaltyEntry } from "../../domain/interfaces/loyalty.interface";
import { LoyaltyRepository } from "../../domain/repositories/loyalty.repository";
import { AdjustLoyaltyDto } from "../dto/loyalty.dto";

@Injectable()
export class AdjustLoyaltyUsecase {
  constructor(
    private readonly loyaltyRepository: LoyaltyRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  /** A manual correction or goodwill grant. Appends a line; never edits history, and never takes a balance below zero. */
  async execute(customerId: string, dto: AdjustLoyaltyDto, authEntity: AuthEntity): Promise<{ balance: number; entry: ILoyaltyEntry }> {
    const { restaurantId } = authEntity;
    const customer = await this.loyaltyRepository.findCustomer(restaurantId, customerId);
    if (!customer) throw new NotFoundException(LOYALTY_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);

    return this.loyaltyRepository.$transaction(async tx => {
      await this.loyaltyRepository.lockLedger(restaurantId, customerId, { tx });
      const before = await this.loyaltyRepository.getBalance(restaurantId, customerId, { tx });
      if (before + dto.points < 0) throw new ConflictException(LOYALTY_ERROR_MESSAGES.INSUFFICIENT_POINTS);

      const entry = await this.loyaltyRepository.createEntry(
        {
          restaurantId,
          customerId,
          type: LoyaltyEntryType.ADJUST,
          points: dto.points,
          note: dto.note,
          createdBy: authEntity.sub,
          createdByName: authEntity.name,
        },
        { tx }
      );

      await this.auditLogService.record(
        {
          action: AuditAction.loyalty_adjusted,
          subject: customer.name,
          detail: `${dto.points > 0 ? "+" : ""}${dto.points} points (${before} → ${before + dto.points}): ${dto.note}`,
        },
        authEntity,
        tx
      );

      return { balance: before + dto.points, entry };
    });
  }
}
