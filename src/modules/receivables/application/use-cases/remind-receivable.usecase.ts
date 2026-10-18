import { Injectable } from "@nestjs/common";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ReceivableRepository } from "../../infrastructure/receivable.repository";

/** Records that staff chased this customer. Refuses when nothing is owed, so the log never holds a reminder for a clear tab. */
@Injectable()
export class RemindReceivableUsecase {
  constructor(private readonly repository: ReceivableRepository) {}

  async execute(customerId: string, authEntity: AuthEntity) {
    const amount = await this.repository.owedBy(authEntity.restaurantId, authEntity.branchId, customerId);
    if (amount <= 0) throw new ConflictException({ key: "NOTHING_OWED", message: "This customer owes nothing here" });
    const row = await this.repository.addReminder({ restaurantId: authEntity.restaurantId, customerId, amount, createdBy: authEntity.sub, createdByName: authEntity.name });
    return { id: row.id, amount, createdAt: row.createdAt };
  }
}
