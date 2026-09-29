import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ADD_ON_ERROR_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";

@Injectable()
export class FetchAddOnByIdUsecase {
  constructor(private readonly addOnRepository: AddOnRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IAddOn> {
    const addOn = await this.addOnRepository.findById(id);
    if (!addOn || addOn.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ADD_ON_ERROR_MESSAGES.NOT_FOUND);
    }

    return addOn;
  }
}
