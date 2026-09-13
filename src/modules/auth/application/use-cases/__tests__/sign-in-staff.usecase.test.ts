import { Test, TestingModule } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../../../common/constants";
import { UnauthorizedException } from "../../../../../common/exceptions";
import { IStaffMember } from "../../../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../../users/domain/repositories/user.repository";
import { hashPin } from "../../../../users/domain/utils/pin.util";
import { AuthTokenService } from "../../auth-token.service";
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SignInStaffUsecase", () => {
  let usecase: SignInStaffUsecase;
  let userRepository: jest.Mocked<UserRepository>;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;
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
      ],
    }).compile();

    usecase = module.get(SignInStaffUsecase);
    userRepository = module.get(UserRepository);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
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
