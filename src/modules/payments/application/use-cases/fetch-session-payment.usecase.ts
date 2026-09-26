import { Injectable } from "@nestjs/common";
import { UnauthorizedException } from "../../../../common/exceptions";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../dining-sessions/domain/constants";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { PaymentRepository } from "../../domain/repositories/payment.repository";

/**
 * Diner-facing lookup — deliberately not gated by `DinerSessionGuard`'s
 * `resolveActive`. Settling a table ends the session in the same motion, so
 * a diner asking "did this settle?" right after staff took payment is asking
 * about the one session state (`endedAt` set) that guard would reject. Any
 * token that ever resolved to a real session is enough here; a session with
 * nothing charged yet is a normal state, not an error.
 */
@Injectable()
export class FetchSessionPaymentUsecase {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly paymentRepository: PaymentRepository
  ) {}

  async execute(token: string): Promise<IPaymentWithItems | null> {
    const session = await this.diningSessionRepository.findByToken(token);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    return this.paymentRepository.findBySessionId(session.id);
  }
}
