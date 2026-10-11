import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { DEFAULT_LOYALTY_PROGRAM } from "../../domain/constants";
import { ILoyaltyProgram } from "../../domain/interfaces/loyalty.interface";
import { LoyaltyRepository } from "../../domain/repositories/loyalty.repository";

@Injectable()
export class GetLoyaltyProgramUsecase {
  constructor(private readonly loyaltyRepository: LoyaltyRepository) {}

  async execute(authEntity: AuthEntity): Promise<ILoyaltyProgram> {
    return (await this.loyaltyRepository.findProgram(authEntity.restaurantId)) ?? DEFAULT_LOYALTY_PROGRAM;
  }
}
