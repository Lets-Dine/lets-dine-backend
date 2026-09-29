import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { UnauthorizedException } from "../../../../../common/exceptions";
import { DiningSessionService } from "../../../application/dining-session.service";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { IDiningSession } from "../../../domain/interfaces/dining-session.interface";
import { SESSION_TOKEN_HEADER } from "./diner-session.guard";

/**
 * `DinerSessionGuard`'s counterpart for routes about a past visit rather
 * than the table's current one — fetching an order, submitting a review.
 * A diner rating a dish after staff has cleared the table still holds the
 * same token; it must keep resolving even though the table itself has
 * long since moved on to its next visit.
 */
@Injectable()
export class DinerSessionAnyGuard implements CanActivate {
  constructor(private readonly diningSessionService: DiningSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { diningSession?: IDiningSession }>();
    const token = request.headers[SESSION_TOKEN_HEADER];

    if (typeof token !== "string" || token.length === 0) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.REQUIRED);
    }

    request.diningSession = await this.diningSessionService.resolveAny(token);

    return true;
  }
}
