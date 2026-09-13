import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AUTH_ERROR_MESSAGES } from "../../constants/auth-error-message";
import { UnauthorizedException } from "../../exceptions";

/**
 * §4.4 — platform administration is deliberately thin for the MVP: the
 * onboarding endpoints answer only to a shared key held by the operator, not to
 * a role in the database.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PLATFORM_ADMIN_KEY;
    const provided = context.switchToHttp().getRequest<Request>().headers["x-platform-key"];

    if (!expected || provided !== expected) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);

    return true;
  }
}
