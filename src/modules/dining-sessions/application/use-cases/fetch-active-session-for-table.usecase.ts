import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../tables/domain/constants";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { IDiningSession } from "../../domain/interfaces/dining-session.interface";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";

/** Get the currently active dining session for a table (if any). */
@Injectable()
export class FetchActiveSessionForTableUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly diningSessionRepository: DiningSessionRepository
  ) {}

  async execute(tableId: string): Promise<IDiningSession | null> {
    const table = await this.diningTableRepository.findById(tableId);
    if (!table) throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);

    return this.diningSessionRepository.findActiveByTableId(tableId);
  }
}