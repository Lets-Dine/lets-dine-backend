import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_ERROR_MESSAGES } from "../../constants/auth-error-message";
import { ForbiddenException } from "../../exceptions";
import { AuthEntity } from "../../interfaces/auth-entity.interface";
import { CHECK_POLICIES_KEY, PolicyHandler } from "../check-policies.decorator";

/** Runs after AuthGuard: enforces the @CheckPolicies rules against the token's role. */
@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [context.getHandler(), context.getClass()]);
    if (!handlers?.length) return true;

    const { authEntity } = context.switchToHttp().getRequest<{ authEntity?: AuthEntity }>();
    if (!authEntity) throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);

    const allowed = handlers.every(handler => handler(authEntity.role));
    if (!allowed) throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);

    return true;
  }
}
