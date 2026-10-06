import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { ICashClose } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { FetchLedgerListQuery } from "../../interfaces/http/validations/fetch-ledger-list.validation";

@Injectable()
export class ListClosesUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(query: FetchLedgerListQuery, authEntity: AuthEntity): Promise<PaginatedResponse<ICashClose>> {
    return this.ledgerRepository.fetchCloses({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId }, query);
  }
}
