import { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "../../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../../common/testing";
import { EntitlementService } from "../../../../application/entitlement.service";
import { SubscriptionActiveGuard } from "../subscription-active.guard";

const authEntity = buildAuthEntity();

const contextFor = (request: { method: string; authEntity?: unknown }) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe("SubscriptionActiveGuard", () => {
  let entitlementService: { assertNotRestricted: jest.Mock };
  let guard: SubscriptionActiveGuard;

  beforeEach(() => {
    entitlementService = { assertNotRestricted: jest.fn().mockResolvedValue(undefined) };
    guard = new SubscriptionActiveGuard(entitlementService as unknown as EntitlementService);
  });

  describe("canActivate", () => {
    it.each(["GET", "HEAD", "OPTIONS"])("should always let a %s through without asking billing", async method => {
      // Act & Assert
      await expect(guard.canActivate(contextFor({ method, authEntity }))).resolves.toBe(true);
      expect(entitlementService.assertNotRestricted).not.toHaveBeenCalled();
    });

    it.each(["POST", "PATCH", "PUT", "DELETE"])("should check the token's restaurant before allowing a %s", async method => {
      // Act
      const allowed = await guard.canActivate(contextFor({ method, authEntity }));

      // Assert
      expect(allowed).toBe(true);
      expect(entitlementService.assertNotRestricted).toHaveBeenCalledWith(authEntity.restaurantId);
    });

    it("should block a write while the subscription is restricted", async () => {
      // Arrange
      entitlementService.assertNotRestricted.mockRejectedValue(
        new ForbiddenException({ key: "SUBSCRIPTION_RESTRICTED", message: "restricted" })
      );

      // Act & Assert
      await expect(guard.canActivate(contextFor({ method: "POST", authEntity }))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("should refuse a write that reached it unauthenticated, because AuthGuard is meant to run first", async () => {
      // Act & Assert
      await expect(guard.canActivate(contextFor({ method: "POST" }))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(entitlementService.assertNotRestricted).not.toHaveBeenCalled();
    });
  });
});
