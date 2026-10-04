import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AUTH_ERROR_MESSAGES } from "../../../../../common/constants/auth-error-message";
import { UnauthorizedException } from "../../../../../common/exceptions";
import { AuthEntity } from "../../../../../common/interfaces/auth-entity.interface";
import { EntitlementService } from "../../../application/entitlement.service";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Blocks configuration edits (menu, floors, tables, branches, profile) while the
 * subscription is restricted or suspended. Reads always pass, and it is never
 * applied to the order or payment routes — those keep working whatever the status.
 *
 * Must come after AuthGuard in the guard list, which is what attaches `authEntity`.
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly entitlementService: EntitlementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { authEntity?: AuthEntity }>();
    if (SAFE_METHODS.has(request.method)) return true;

    if (!request.authEntity) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.MISSING_TOKEN);
    await this.entitlementService.assertNotRestricted(request.authEntity.restaurantId);
    return true;
  }
}
