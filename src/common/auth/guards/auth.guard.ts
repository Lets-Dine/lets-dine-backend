import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AUTH_ERROR_MESSAGES } from "../../constants/auth-error-message";
import { UnauthorizedException } from "../../exceptions";
import { AuthEntity } from "../../interfaces/auth-entity.interface";

/**
 * Verifies the staff bearer token and attaches the decoded AuthEntity to the
 * request. Restaurant scope comes from the token — never from the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { authEntity?: AuthEntity }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.MISSING_TOKEN);

    try {
      request.authEntity = await this.jwtService.verifyAsync<AuthEntity>(token);
    } catch {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    return scheme === "Bearer" && token ? token : null;
  }
}
