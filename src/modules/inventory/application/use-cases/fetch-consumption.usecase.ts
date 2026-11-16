import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IConsumptionPage } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { FetchConsumptionInput } from "../../interfaces/http/validations/fetch-consumption.validation";

/** Everything this branch took out of stock, newest first, a page at a time: dishes, manual use and waste. */
@Injectable()
export class FetchConsumptionUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  execute(query: FetchConsumptionInput, authEntity: AuthEntity): Promise<IConsumptionPage> {
    return this.inventoryRepository.findConsumption(authEntity.branchId, query);
  }
}
