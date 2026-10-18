import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IWasteReport } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { summarizeWaste } from "../../domain/utils/waste.util";
import { FetchWasteInput } from "../../interfaces/http/validations/fetch-waste.validation";

const DAY = 86_400_000;
const RECENT = 20;

/** What was thrown away in a period, by reason and by ingredient, with the latest entries. Defaults to the last 30 days. */
@Injectable()
export class FetchWasteReportUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(query: FetchWasteInput, authEntity: AuthEntity): Promise<IWasteReport> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * DAY);
    const entries = await this.inventoryRepository.findWaste(authEntity.branchId, from, to);
    return { from, to, ...summarizeWaste(entries), recent: entries.slice(0, RECENT) };
  }
}
