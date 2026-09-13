import { Injectable } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { IStaffMember } from "../../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { hashPin } from "../../../users/domain/utils/pin.util";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";
import { RegisterRestaurantInput } from "../../interfaces/http/validations/register-restaurant.validation";

export interface IRegisteredRestaurant {
  restaurant: IRestaurant;
  owner: IStaffMember;
}

/**
 * Platform onboarding. The restaurant, its first OWNER account and the
 * membership joining them are created together — a restaurant nobody can sign
 * in to is not a useful half-result.
 */
@Injectable()
export class RegisterRestaurantUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly userRepository: UserRepository,
    private readonly restaurantMemberRepository: RestaurantMemberRepository
  ) {}

  async execute(dto: RegisterRestaurantInput): Promise<IRegisteredRestaurant> {
    const existingRestaurant = await this.restaurantRepository.findBySlug(dto.slug);
    if (existingRestaurant) throw new ConflictException(RESTAURANT_ERROR_MESSAGES.SLUG_ALREADY_EXISTS);

    const existingUser = await this.userRepository.findByEmail(dto.owner.email);
    if (existingUser) throw new ConflictException(RESTAURANT_ERROR_MESSAGES.OWNER_EMAIL_ALREADY_EXISTS);

    const { owner, ...restaurantData } = dto;
    const pinHash = await hashPin(owner.pin);

    return this.restaurantRepository.$transaction(async tx => {
      const restaurant = await this.restaurantRepository.create(restaurantData, { tx });
      const user = await this.userRepository.create({ email: owner.email, name: owner.name, pinHash }, { tx });
      const member = await this.restaurantMemberRepository.create(
        { userId: user.id, restaurantId: restaurant.id, role: StaffRole.OWNER },
        { tx }
      );

      return { restaurant, owner: member };
    });
  }
}
