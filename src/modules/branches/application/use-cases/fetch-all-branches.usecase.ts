import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IBranch } from "../../domain/interfaces/branch.interface";
import { BranchRepository } from "../../domain/repositories/branch.repository";
import { FetchBranchesQuery } from "../../interfaces/http/validations/fetch-branches.validation";

@Injectable()
export class FetchAllBranchesUsecase {
  constructor(private readonly branchRepository: BranchRepository) {}

  async execute(query: FetchBranchesQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IBranch>> {
    const { keyword, isActive, ...pagination } = query;
    return this.branchRepository.fetchAll(
      {
        restaurantId: authEntity.restaurantId,
        branchIds: authEntity.branchIds === "all" ? undefined : authEntity.branchIds,
        keyword,
        isActive,
      },
      pagination
    );
  }
}
