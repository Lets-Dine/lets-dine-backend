import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { PaymentRepository } from "../../domain/repositories/payment.repository";

/** How much of each order line a session's split bills already cover — what the sheet subtracts to show what is left. */
@Injectable()
export class FetchBilledItemsUsecase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly diningSessionRepository: DiningSessionRepository
  ) {}

  async execute(sessionId: string, authEntity: AuthEntity): Promise<{ orderItemId: string; quantity: number }[]> {
    const session = await this.diningSessionRepository.findById(sessionId);
    if (!session || !isInActiveBranch(authEntity, session)) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND);
    const rows = await this.paymentRepository.billedItems(sessionId);
    return rows.flatMap(row => (row.orderItemId ? [{ orderItemId: row.orderItemId, quantity: row.quantity }] : []));
  }
}
