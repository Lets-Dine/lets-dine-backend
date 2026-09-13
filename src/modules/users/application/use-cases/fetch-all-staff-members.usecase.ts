import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../domain/repositories/restaurant-member.repository";
import { FetchStaffMembersQuery } from "../../interfaces/http/validations/fetch-staff-members.validation";

@Injectable()
export class FetchAllStaffMembersUsecase {
  constructor(private readonly restaurantMemberRepository: RestaurantMemberRepository) {}

  async execute(query: FetchStaffMembersQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IStaffMember>> {
    const { keyword, role, isActive, ...pagination } = query;

    return this.restaurantMemberRepository.fetchAll({ restaurantId: authEntity.restaurantId, keyword, role, isActive }, pagination);
  }
}
