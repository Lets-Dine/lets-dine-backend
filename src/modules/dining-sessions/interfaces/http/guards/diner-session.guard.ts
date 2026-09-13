import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { UnauthorizedException } from "../../../../../common/exceptions";
import { DiningSessionService } from "../../../application/dining-session.service";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { IDiningSession } from "../../../domain/interfaces/dining-session.interface";

export const SESSION_TOKEN_HEADER = "x-session-token";

/**
 * The diner side's equivalent of AuthGuard: no account, just the table session
 * opened by scanning the QR. Attaches the resolved session to the request.
 */
@Injectable()
export class DinerSessionGuard implements CanActivate {
  constructor(private readonly diningSessionService: DiningSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { diningSession?: IDiningSession }>();
    const token = request.headers[SESSION_TOKEN_HEADER];

    if (typeof token !== "string" || token.length === 0) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.REQUIRED);
    }

    request.diningSession = await this.diningSessionService.resolveActive(token);

    return true;
  }
}
