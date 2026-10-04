import { Test, TestingModule } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../../../common/constants";
import { StaffAccessPolicy } from "../../../../../common/auth";
import { ForbiddenException, UnauthorizedException } from "../../../../../common/exceptions";
import { IStaffMember } from "../../../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../../users/domain/repositories/user.repository";
import { hashPin } from "../../../../users/domain/utils/pin.util";
import { AuthTokenService } from "../../auth-token.service";
import { BranchScopeService } from "../../branch-scope.service";
import { SignInStaffUsecase } from "../sign-in-staff.usecase";

const PIN = "4821";

function buildMember(overrides: Partial<IStaffMember> = {}): IStaffMember {
  return {
    id: "member-1",
    userId: "user-1",
    restaurantId: "restaurant-1",
    role: StaffRole.MANAGER,
    isActive: true,
    name: "Aarati Shrestha",
    email: "aarati@lets-dine.test",
    branchIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const branch = { id: "branch-1", name: "Main", slug: "main", isDefault: true } as any;
const scope = { branches: [branch], active: branch, branchIds: ["branch-1"] };

describe("SignInStaffUsecase", () => {
  let usecase: SignInStaffUsecase;
  let userRepository: jest.Mocked<UserRepository>;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;
  let branchScopeService: jest.Mocked<BranchScopeService>;
  let authTokenService: jest.Mocked<AuthTokenService>;
  let staffAccessPolicy: jest.Mocked<StaffAccessPolicy>;
  let pinHash: string;

  beforeAll(async () => {
    pinHash = await hashPin(PIN);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignInStaffUsecase,
        { provide: UserRepository, useValue: { findByEmail: jest.fn() } },
        { provide: RestaurantMemberRepository, useValue: { findActiveByUserId: jest.fn() } },
        { provide: AuthTokenService, useValue: { issue: jest.fn().mockResolvedValue("signed.jwt.token") } },
        { provide: BranchScopeService, useValue: { resolve: jest.fn().mockResolvedValue(scope) } },
        { provide: StaffAccessPolicy, useValue: { assertCanAccess: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    usecase = module.get(SignInStaffUsecase);
    userRepository = module.get(UserRepository);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
    branchScopeService = module.get(BranchScopeService);
    authTokenService = module.get(AuthTokenService);
    staffAccessPolicy = module.get(StaffAccessPolicy);
  });

  describe("execute", () => {
    it("should return a token and the profile for a correct PIN", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({
        id: "user-1",
        email: "aarati@lets-dine.test",
        name: "Aarati Shrestha",
        isActive: true,
        pinHash,
      } as any);
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([buildMember()]);

      // Act
      const result = await usecase.execute({ email: "aarati@lets-dine.test", pin: PIN });

      // Assert
      expect(result.accessToken).toBe("signed.jwt.token");
      expect(result.profile).toMatchObject({ memberId: "member-1", restaurantId: "restaurant-1", role: "MANAGER" });
      expect(result.profile.memberships).toHaveLength(1);
      expect(result.profile).toMatchObject({ branchId: "branch-1", branches: [branch] });
      expect(authTokenService.issue).toHaveBeenCalledWith(expect.objectContaining({ id: "member-1" }), {
        branchId: "branch-1",
        branchIds: ["branch-1"],
      });
    });

    it("should start in the requested branch", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, pinHash } as any);
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([buildMember()]);

      // Act
      await usecase.execute({ email: "aarati@lets-dine.test", pin: PIN, branchId: "branch-1" });

      // Assert
      expect(branchScopeService.resolve).toHaveBeenCalledWith(expect.objectContaining({ id: "member-1" }), "branch-1");
    });

    it("should sign in to the requested restaurant when the person works at several", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, pinHash } as any);
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([
        buildMember(),
        buildMember({ id: "member-2", restaurantId: "restaurant-2", role: StaffRole.STAFF }),
      ]);

      // Act
      const result = await usecase.execute({ email: "aarati@lets-dine.test", pin: PIN, restaurantId: "restaurant-2" });

      // Assert
      expect(result.profile.memberId).toBe("member-2");
    });

    describe("when a restaurant's subscription is suspended", () => {
      const suspended = new ForbiddenException({ key: "SUBSCRIPTION_SUSPENDED", message: "suspended" });
      const signIn = { email: "aarati@lets-dine.test", pin: PIN };

      beforeEach(() => {
        userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, pinHash } as any);
      });

      it("should ask the access policy about the restaurant being signed in to, letting an owner through (they need billing)", async () => {
        // Arrange
        const owner = buildMember({ role: StaffRole.OWNER });
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([owner]);

        // Act
        await usecase.execute(signIn);

        // Assert
        expect(staffAccessPolicy.assertCanAccess).toHaveBeenCalledWith(owner, { allowedWhenSuspended: true });
      });

      it("should refuse the sign-in, without minting a token, when the policy locks the member out", async () => {
        // Arrange
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([buildMember()]);
        staffAccessPolicy.assertCanAccess.mockRejectedValue(suspended);

        // Act & Assert
        await expect(usecase.execute(signIn)).rejects.toBe(suspended);
        expect(authTokenService.issue).not.toHaveBeenCalled();
      });

      it("should refuse a requested restaurant that is locked, rather than quietly signing in to another", async () => {
        // Arrange
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([
          buildMember(),
          buildMember({ id: "member-2", restaurantId: "restaurant-2" }),
        ]);
        staffAccessPolicy.assertCanAccess.mockImplementation(async subject => {
          if (subject.restaurantId === "restaurant-2") throw suspended;
        });

        // Act & Assert
        await expect(usecase.execute({ ...signIn, restaurantId: "restaurant-2" })).rejects.toBe(suspended);
        expect(authTokenService.issue).not.toHaveBeenCalled();
      });

      it("should, when no restaurant is requested, sign in to the first one the person can actually get into", async () => {
        // Arrange — locked out of the first, fine at the second
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([
          buildMember(),
          buildMember({ id: "member-2", restaurantId: "restaurant-2" }),
        ]);
        staffAccessPolicy.assertCanAccess.mockImplementation(async subject => {
          if (subject.restaurantId === "restaurant-1") throw suspended;
        });

        // Act
        const result = await usecase.execute(signIn);

        // Assert
        expect(result.profile.memberId).toBe("member-2");
      });

      it("should tell the person why when every restaurant they work at is locked", async () => {
        // Arrange
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([
          buildMember(),
          buildMember({ id: "member-2", restaurantId: "restaurant-2" }),
        ]);
        staffAccessPolicy.assertCanAccess.mockRejectedValue(suspended);

        // Act & Assert
        await expect(usecase.execute(signIn)).rejects.toBe(suspended);
      });

      it("should not hide a policy failure that is not a lockout", async () => {
        // Arrange
        restaurantMemberRepository.findActiveByUserId.mockResolvedValue([buildMember()]);
        staffAccessPolicy.assertCanAccess.mockRejectedValue(new Error("db down"));

        // Act & Assert
        await expect(usecase.execute(signIn)).rejects.toThrow("db down");
      });
    });

    it("should throw UnauthorizedException for an unknown email", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ email: "nobody@lets-dine.test", pin: PIN })).rejects.toThrow(
        new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS)
      );
    });

    it("should throw UnauthorizedException for a deactivated account", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: false, pinHash } as any);

      // Act & Assert
      await expect(usecase.execute({ email: "aarati@lets-dine.test", pin: PIN })).rejects.toThrow(
        new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE)
      );
    });

    it("should throw UnauthorizedException for a wrong PIN", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, pinHash } as any);

      // Act & Assert
      await expect(usecase.execute({ email: "aarati@lets-dine.test", pin: "0000" })).rejects.toThrow(
        new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS)
      );
      expect(restaurantMemberRepository.findActiveByUserId).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when no active membership is left", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, pinHash } as any);
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ email: "aarati@lets-dine.test", pin: PIN })).rejects.toThrow(
        new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE)
      );
    });
  });
});
