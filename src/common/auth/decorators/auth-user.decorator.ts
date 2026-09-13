import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthEntity } from "../../interfaces/auth-entity.interface";

/** The staff member behind the request, as attached by AuthGuard. */
export const AuthUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthEntity => {
  return context.switchToHttp().getRequest().authEntity;
});
