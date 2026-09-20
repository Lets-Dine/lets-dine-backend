import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { DiningSessionService } from "../dining-session.service";

/**
 * Lets a manager clear a table by hand — either because the guests left
 * without ordering, or right after settling their bill, so the next party's
 * QR scan starts a fresh visit instead of joining the one just paid for.
 */
@Injectable()
export class EndDiningSessionUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly diningSessionService: DiningSessionService
  ) {}

  async execute(tableId: string, authEntity: AuthEntity): Promise<IDiningTable> {
    const table = await this.diningTableRepository.findById(tableId);
    if (!table || table.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND);
    }

    return this.diningTableRepository.$transaction(async tx => {
      await this.diningTableRepository.lockById(table.id, { tx });
      const session = await this.diningSessionRepository.findOpenByTableId(table.id, { tx });
      if (!session) throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.NO_ACTIVE_SESSION);

      return this.diningSessionService.endSession(session, authEntity, tx);
    });
  }
}
