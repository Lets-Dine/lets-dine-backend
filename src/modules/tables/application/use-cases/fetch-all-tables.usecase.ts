import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../domain/repositories/dining-table.repository";
import { FetchTablesQuery } from "../../interfaces/http/validations/fetch-tables.validation";

@Injectable()
export class FetchAllTablesUsecase {
  constructor(private readonly diningTableRepository: DiningTableRepository) {}

  async execute(query: FetchTablesQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IDiningTable>> {
    const { keyword, isActive, ...pagination } = query;
    return this.diningTableRepository.fetchAll({ restaurantId: authEntity.restaurantId, keyword, isActive }, pagination);
  }
}
