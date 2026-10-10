import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";
import { FetchAddOnsQuery } from "../../interfaces/http/validations/fetch-add-ons.validation";

/** The dashboard's add-on catalog: every add-on, archived ones included on request. */
@Injectable()
export class FetchAllAddOnsUsecase {
  constructor(private readonly addOnRepository: AddOnRepository) {}

  async execute(query: FetchAddOnsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IAddOn>> {
    const { keyword, isAvailable, isArchived, ...pagination } = query;

    return this.addOnRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, keyword, isAvailable, isArchived },
      pagination
    );
  }
}
