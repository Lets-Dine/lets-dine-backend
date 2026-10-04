import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ForbiddenException, UnauthorizedException } from "../../../exceptions";
import { buildAuthEntity } from "../../../testing";
import { ALLOW_WHEN_SUSPENDED_KEY, AllowWhenSuspended, StaffAccessPolicy } from "../../staff-access.policy";
import { AuthGuard } from "../auth.guard";

const authEntity = buildAuthEntity();

class OpenRoute {
  handler() {}
}
class BillingRoute {
  @AllowWhenSuspended()
  handler() {}
}

const contextFor = (request: Record<string, unknown>, route: { prototype: { handler: () => void } } & (new () => unknown) = OpenRoute) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => route.prototype.handler,
    getClass: () => route,
  }) as unknown as ExecutionContext;

const requestWithToken = (token = "good.jwt") => ({ headers: { authorization: `Bearer ${token}` } }) as Record<string, any>;

describe("AuthGuard", () => {
  let jwtService: { verifyAsync: jest.Mock };
  let policy: { assertCanAccess: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(authEntity) };
    policy = { assertCanAccess: jest.fn().mockResolvedValue(undefined) };
    guard = new AuthGuard(jwtService as unknown as JwtService, new Reflector(), policy as unknown as StaffAccessPolicy);
  });

  describe("canActivate", () => {
    it("should attach the verified token's entity to the request and let it through", async () => {
      // Arrange
      const request = requestWithToken();

      // Act
      const allowed = await guard.canActivate(contextFor(request));

      // Assert
      expect(allowed).toBe(true);
      expect(request.authEntity).toBe(authEntity);
    });

    it("should refuse a request with no token, before asking anyone anything", async () => {
      // Act & Assert
      await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it("should refuse a token that does not verify", async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));

      // Act & Assert
      await expect(guard.canActivate(contextFor(requestWithToken()))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(policy.assertCanAccess).not.toHaveBeenCalled();
    });

    it("should refuse a token minted before branch scoping existed", async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue({ ...authEntity, branchId: undefined });

      // Act & Assert
      await expect(guard.canActivate(contextFor(requestWithToken()))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    describe("access policy", () => {
      it("should ask the policy about the token's own restaurant and role on every request", async () => {
        // Act
        await guard.canActivate(contextFor(requestWithToken()));

        // Assert
        expect(policy.assertCanAccess).toHaveBeenCalledWith(authEntity, { allowedWhenSuspended: false });
      });

      it("should tell the policy a route is open to a locked-out owner when it is marked so", async () => {
        // Act
        await guard.canActivate(contextFor(requestWithToken(), BillingRoute));

        // Assert
        expect(policy.assertCanAccess).toHaveBeenCalledWith(authEntity, { allowedWhenSuspended: true });
      });

      it("should surface the policy's own ForbiddenException, not disguise it as an invalid token, and attach nothing", async () => {
        // Arrange
        const suspended = new ForbiddenException({ key: "SUBSCRIPTION_SUSPENDED", message: "suspended" });
        policy.assertCanAccess.mockRejectedValue(suspended);
        const request = requestWithToken();

        // Act & Assert
        await expect(guard.canActivate(contextFor(request))).rejects.toBe(suspended);
        expect(request.authEntity).toBeUndefined();
      });

      it("should work without a policy at all, as in a build that has no billing", async () => {
        // Arrange
        const bare = new AuthGuard(jwtService as unknown as JwtService, new Reflector());

        // Act & Assert
        await expect(bare.canActivate(contextFor(requestWithToken()))).resolves.toBe(true);
      });
    });
  });

  it("should mark routes through the metadata key the guard reads", () => {
    // Act & Assert
    expect(Reflect.getMetadata(ALLOW_WHEN_SUSPENDED_KEY, BillingRoute.prototype.handler)).toBe(true);
  });
});
