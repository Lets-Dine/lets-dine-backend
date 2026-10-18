import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IExpiringLot } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { FetchExpiringInput } from "../../interfaces/http/validations/fetch-expiring.validation";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stock on the shelf that is past its best-before day or will be within `days`, soonest first. */
@Injectable()
export class FetchExpiringUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(query: FetchExpiringInput, authEntity: AuthEntity): Promise<IExpiringLot[]> {
    const timeZone = await this.inventoryRepository.findBranchTimezone(authEntity.branchId);
    // Expiry days are stored as midnight UTC, so compare against the branch's calendar day in the same form.
    const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())}T00:00:00Z`);
    return this.inventoryRepository.findExpiringLots(authEntity.branchId, new Date(today.getTime() + (query.days + 1) * DAY_MS));
  }
}
