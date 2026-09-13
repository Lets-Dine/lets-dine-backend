import { Injectable } from "@nestjs/common";
import { UnauthorizedException } from "../../../common/exceptions";
import { PrismaTransaction } from "../../../common/prisma";
import { DINING_SESSION_ERROR_MESSAGES } from "../domain/constants";
import { IDiningSession } from "../domain/interfaces/dining-session.interface";
import { DiningSessionRepository } from "../domain/repositories/dining-session.repository";

/**
 * The one place a diner's token becomes a session. Everything the diner can do —
 * ordering, reviewing — hangs off this check, so it lives in a service rather
 * than being re-implemented per use case.
 */
@Injectable()
export class DiningSessionService {
  constructor(private readonly diningSessionRepository: DiningSessionRepository) {}

  async resolveActive(token: string, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const session = await this.diningSessionRepository.findByToken(token, options);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    if (session.endedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    return session;
  }
}
