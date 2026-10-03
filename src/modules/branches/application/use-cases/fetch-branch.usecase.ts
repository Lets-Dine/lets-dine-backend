import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, canAccessBranch } from "../../../../common/interfaces";
import { BRANCH_ERROR_MESSAGES } from "../../domain/constants";
import { IBranchWithHours } from "../../domain/interfaces/branch.interface";
import { BranchRepository } from "../../domain/repositories/branch.repository";

@Injectable()
export class FetchBranchUsecase {
  constructor(private readonly branchRepository: BranchRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IBranchWithHours> {
    const branch = await this.branchRepository.findById(id);
    if (!branch || branch.restaurantId !== authEntity.restaurantId || !canAccessBranch(authEntity, id)) {
      throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);
    }
    return branch;
  }
}
