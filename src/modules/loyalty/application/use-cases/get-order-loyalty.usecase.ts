import { Injectable } from "@nestjs/common";
import { OrderType } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { LOYALTY_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderLoyalty } from "../../domain/interfaces/loyalty.interface";
import { pointsFor } from "../../domain/utils/points.util";
import { LoyaltyRepository } from "../../domain/repositories/loyalty.repository";

/**
 * What a diner is told about points on one of their own orders: what its bill earned and what rating a
 * dish would add. Deliberately no balance, name or phone — a phone number is typed in unchecked, so
 * anyone can claim someone else's, and the page is open to whoever holds the table's link.
 */
@Injectable()
export class GetOrderLoyaltyUsecase {
  constructor(private readonly loyaltyRepository: LoyaltyRepository) {}

  /** Null when there is nothing to say: the program is off, or no customer is attached to the order. */
  async execute(orderId: string, session: IDiningSession): Promise<IOrderLoyalty | null> {
    const order = await this.loyaltyRepository.findOrder(orderId);
    if (!order || order.sessionId !== session.id) throw new NotFoundException(LOYALTY_ERROR_MESSAGES.ORDER_NOT_FOUND);
    // A floor or delivery order is billed on its own, to its own customer; a table's bill spans the visit's
    // orders and is charged to the visit's customer. Which customer, and so whose points, follows the payment.
    const ownBill = order.floorId !== null || order.orderType === OrderType.DELIVERY;
    const customerId = ownBill ? order.customerId : (session.customerId ?? order.customerId);
    if (!customerId) return null;

    const program = await this.loyaltyRepository.findProgram(order.restaurantId);
    if (!program?.enabled) return null;

    const [earned, reviewBonusGiven, paid] = await Promise.all([
      ownBill
        ? this.loyaltyRepository.sumEarnedForOrder(order.id)
        : this.loyaltyRepository.sumEarnedForSession(order.sessionId, customerId),
      this.loyaltyRepository.hasOrderEntry(order.id, "REVIEW_BONUS"),
      ownBill ? Promise.resolve(order.paidAt !== null) : this.loyaltyRepository.hasSessionPayment(order.sessionId),
    ]);

    // Before the bill is paid there is nothing earned yet: say what it should earn, on the same base the payment
    // will use (the cashier's own discount will lower it; points spent do not). Once paid, only what was earned is shown.
    const base = ownBill ? order.subtotal - order.discount : await this.loyaltyRepository.sumVisitEarnableBase(order.sessionId);
    const expected = earned > 0 || paid ? 0 : pointsFor(base, 0, program.spendPerPoint);
    return { earned, reviewBonus: reviewBonusGiven ? 0 : program.reviewBonus, reviewBonusGiven, expected };
  }
}
