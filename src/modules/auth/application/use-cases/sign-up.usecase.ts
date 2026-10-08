import { Injectable } from "@nestjs/common";
import { RegisterRestaurantUsecase } from "../../../restaurants/application/use-cases/register-restaurant.usecase";
import { SignUpRestaurantInput } from "../../../restaurants/interfaces/http/validations/register-restaurant.validation";
import { IAuthSession } from "../../domain/interfaces/auth-session.interface";
import { SignInStaffUsecase } from "./sign-in-staff.usecase";

/** Self sign-up: creates the restaurant, its owner and the trial, then signs the owner straight in with the PIN they chose. */
@Injectable()
export class SignUpUsecase {
  constructor(
    private readonly registerRestaurantUsecase: RegisterRestaurantUsecase,
    private readonly signInStaffUsecase: SignInStaffUsecase
  ) {}

  async execute(dto: SignUpRestaurantInput): Promise<IAuthSession> {
    const { restaurant } = await this.registerRestaurantUsecase.execute(dto);
    return this.signInStaffUsecase.execute({ email: dto.owner.email, pin: dto.owner.pin, restaurantId: restaurant.id });
  }
}
