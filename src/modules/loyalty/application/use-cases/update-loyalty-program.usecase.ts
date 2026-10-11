import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ILoyaltyProgram } from "../../domain/interfaces/loyalty.interface";
import { LoyaltyRepository } from "../../domain/repositories/loyalty.repository";
import { UpdateLoyaltyProgramDto } from "../dto/loyalty.dto";

@Injectable()
export class UpdateLoyaltyProgramUsecase {
  constructor(
    private readonly loyaltyRepository: LoyaltyRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: UpdateLoyaltyProgramDto, authEntity: AuthEntity): Promise<ILoyaltyProgram> {
    return this.loyaltyRepository.$transaction(async tx => {
      const program = await this.loyaltyRepository.upsertProgram(
        authEntity.restaurantId,
        {
          enabled: dto.enabled,
          spendPerPoint: dto.spendPerPoint,
          redeemValue: dto.redeemValue,
          maxRedeemPct: dto.maxRedeemPct,
          reviewBonus: dto.reviewBonus,
        },
        authEntity.sub,
        { tx }
      );
      await this.auditLogService.record(
        {
          action: AuditAction.loyalty_program_updated,
          subject: "Loyalty points",
          detail: `${program.enabled ? "On" : "Off"} · 1 point per ${(program.spendPerPoint / 100).toFixed(2)} spent · each point worth ${(program.redeemValue / 100).toFixed(2)} · up to ${program.maxRedeemPct}% of a bill · ${program.reviewBonus > 0 ? `${program.reviewBonus} points for a review` : "no review bonus"}`,
        },
        authEntity,
        tx
      );
      return program;
    });
  }
}
