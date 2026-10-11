import { Injectable } from "@nestjs/common";
import { LoyaltyEntryType } from "@prisma/client";
import { PrismaTransaction } from "../../../common/prisma";
import { BadRequestException, ConflictException } from "../../../common/exceptions";
import { LOYALTY_ERROR_MESSAGES } from "../domain/constants";
import { IEarnablePayment } from "../domain/interfaces/loyalty.interface";
import { LoyaltyRepository } from "../domain/repositories/loyalty.repository";
import { maxRedeemablePoints, pointsFor } from "../domain/utils/points.util";

@Injectable()
export class LoyaltyService {
  constructor(private readonly loyaltyRepository: LoyaltyRepository) {}

  /**
   * Credits a settled bill's points. Called inside the settlement's own transaction, so the points
   * commit or roll back with the payment. A no-op — and never an error — when the bill has no
   * customer, the restaurant has no program or has it off, or the bill is too small to earn a point.
   * Safe to repeat for the same payment. Returns the points earned.
   */
  async earnForPayment(payment: IEarnablePayment, tx?: PrismaTransaction): Promise<number> {
    if (!payment.customerId) return 0;
    const program = await this.loyaltyRepository.findProgram(payment.restaurantId, { tx });
    if (!program?.enabled) return 0;

    const points = pointsFor(
      payment.subtotal,
      Math.max(payment.discount - Math.min(payment.loyaltyDiscount ?? 0, payment.discount), 0),
      program.spendPerPoint
    );
    if (points <= 0) return 0;

    await this.loyaltyRepository.createEntry(
      {
        restaurantId: payment.restaurantId,
        customerId: payment.customerId,
        type: LoyaltyEntryType.EARN,
        points,
        paymentId: payment.id,
        orderId: payment.orderId,
      },
      { tx }
    );
    return points;
  }

  /**
   * Checks that a bill may pay `points` of this customer's points and returns the money they take off.
   * Locks the customer's ledger until the transaction ends, so two bills cannot spend the same points.
   * Refuses rather than clamps: the cashier asked for a number, so a number that does not fit is an error.
   */
  async planRedemption(
    input: { restaurantId: string; customerId: string | null; points: number; discountableBase: number },
    tx: PrismaTransaction
  ): Promise<number> {
    const { restaurantId, customerId, points } = input;
    if (!customerId) throw new BadRequestException(LOYALTY_ERROR_MESSAGES.REDEEM_NEEDS_CUSTOMER);
    const program = await this.loyaltyRepository.findProgram(restaurantId, { tx });
    if (!program?.enabled) throw new BadRequestException(LOYALTY_ERROR_MESSAGES.REDEEM_PROGRAM_OFF);

    await this.loyaltyRepository.lockLedger(restaurantId, customerId, { tx });
    const balance = await this.loyaltyRepository.getBalance(restaurantId, customerId, { tx });
    if (points > balance) throw new ConflictException(LOYALTY_ERROR_MESSAGES.REDEEM_OVER_BALANCE);

    const max = maxRedeemablePoints(input.discountableBase, balance, program.redeemValue, program.maxRedeemPct);
    if (points > max) throw new ConflictException({ ...LOYALTY_ERROR_MESSAGES.REDEEM_OVER_CAP, detail: { maxPoints: max } });
    return points * program.redeemValue;
  }

  /** Books the points a bill spent. Called after the payment exists, in the same transaction as `planRedemption`. */
  async recordRedemption(
    input: {
      paymentId: string;
      restaurantId: string;
      customerId: string;
      points: number;
      createdBy?: string | null;
      createdByName?: string | null;
    },
    tx: PrismaTransaction
  ): Promise<void> {
    await this.loyaltyRepository.createEntry(
      {
        restaurantId: input.restaurantId,
        customerId: input.customerId,
        type: LoyaltyEntryType.REDEEM,
        points: -input.points,
        paymentId: input.paymentId,
        createdBy: input.createdBy,
        createdByName: input.createdByName,
      },
      { tx }
    );
  }

  /**
   * Thanks a diner with points for rating a dish: once per order, however many dishes they rate, so rating
   * everything is no faster a way to points than rating one. Independent of the stars given. A no-op when the
   * order has no customer or the program is off or has no bonus. Returns the points granted.
   */
  async grantReviewBonus(order: { id: string; restaurantId: string; customerId: string | null }): Promise<number> {
    if (!order.customerId) return 0;
    const program = await this.loyaltyRepository.findProgram(order.restaurantId);
    if (!program?.enabled || program.reviewBonus <= 0) return 0;

    const customerId = order.customerId;
    return this.loyaltyRepository.$transaction(async tx => {
      await this.loyaltyRepository.lockLedger(order.restaurantId, customerId, { tx });
      if (await this.loyaltyRepository.hasOrderEntry(order.id, LoyaltyEntryType.REVIEW_BONUS, { tx })) return 0;
      await this.loyaltyRepository.createEntry(
        {
          restaurantId: order.restaurantId,
          customerId,
          type: LoyaltyEntryType.REVIEW_BONUS,
          points: program.reviewBonus,
          orderId: order.id,
          note: "Thanks for rating your meal",
        },
        { tx }
      );
      return program.reviewBonus;
    });
  }
}
