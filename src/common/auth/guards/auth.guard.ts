import { CanActivate, ExecutionContext, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AUTH_ERROR_MESSAGES } from "../../constants/auth-error-message";
import { UnauthorizedException } from "../../exceptions";
import { AuthEntity } from "../../interfaces/auth-entity.interface";
import { ALLOW_WHEN_SUSPENDED_KEY, StaffAccessPolicy } from "../staff-access.policy";

/**
 * Verifies the staff bearer token and attaches the decoded AuthEntity to the
 * request. Restaurant scope comes from the token — never from the request.
 *
 * A valid token is not enough on its own: the token outlives a suspension (it is good
 * for days), so every request also asks the access policy whether this member may
 * still be in the app. That is what makes a suspension take effect immediately, not
 * only for the next sign-in.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Optional() private readonly staffAccessPolicy?: StaffAccessPolicy
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { authEntity?: AuthEntity }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.MISSING_TOKEN);

    let authEntity: AuthEntity;
    try {
      authEntity = await this.jwtService.verifyAsync<AuthEntity>(token);
      // Tokens minted before branches existed carry no branch scope — make them sign in again.
      if (!authEntity.branchId || !authEntity.branchIds) throw new Error("token has no branch scope");
    } catch {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Outside the try above on purpose: its ForbiddenException must reach the caller as itself, not become "invalid token".
    if (this.staffAccessPolicy) {
      const allowedWhenSuspended = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_SUSPENDED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      await this.staffAccessPolicy.assertCanAccess(authEntity, { allowedWhenSuspended: allowedWhenSuspended ?? false });
    }

    request.authEntity = authEntity;
    return true;
  }

  private extractToken(request: Request): string | null {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    return scheme === "Bearer" && token ? token : null;
  }
}
