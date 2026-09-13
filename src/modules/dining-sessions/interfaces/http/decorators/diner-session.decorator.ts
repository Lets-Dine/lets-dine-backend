import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { IDiningSession } from "../../../domain/interfaces/dining-session.interface";

/** The table session behind the request, as attached by DinerSessionGuard. */
export const DinerSession = createParamDecorator((_data: unknown, context: ExecutionContext): IDiningSession => {
  return context.switchToHttp().getRequest().diningSession;
});
