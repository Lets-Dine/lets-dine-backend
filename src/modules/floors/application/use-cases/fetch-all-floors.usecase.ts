import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IFloor } from "../../domain/interfaces/floor.interface";
import { FloorRepository } from "../../domain/repositories/floor.repository";
import { FetchFloorsQuery } from "../../interfaces/http/validations/fetch-floors.validation";

@Injectable()
export class FetchAllFloorsUsecase {
  constructor(private readonly floorRepository: FloorRepository) {}

  async execute(query: FetchFloorsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IFloor>> {
    const { keyword, isActive, ...pagination } = query;
    return this.floorRepository.fetchAll({ restaurantId: authEntity.restaurantId, keyword, isActive }, pagination);
  }
}
