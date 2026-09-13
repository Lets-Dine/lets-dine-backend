import { Test, TestingModule } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../../../common/constants";
import { UnauthorizedException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantMemberRepository } from "../../../../users/domain/repositories/restaurant-member.repository";
import { FetchAuthProfileUsecase } from "../fetch-auth-profile.usecase";

const authUser = buildAuthEntity();

describe("FetchAuthProfileUsecase", () => {
  let usecase: FetchAuthProfileUsecase;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchAuthProfileUsecase, { provide: RestaurantMemberRepository, useValue: { findActiveByUserId: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchAuthProfileUsecase);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
  });

  describe("execute", () => {
    it("should return the live membership behind the token", async () => {
      // Arrange
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([
        {
          id: authUser.memberId,
          userId: authUser.sub,
          restaurantId: authUser.restaurantId,
          role: StaffRole.OWNER,
          isActive: true,
          name: authUser.name,
          email: authUser.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Act
      const result = await usecase.execute(authUser);

      // Assert
      expect(result).toMatchObject({ memberId: authUser.memberId, role: StaffRole.OWNER });
    });

    it("should throw UnauthorizedException once the membership is revoked", async () => {
      // Arrange
      restaurantMemberRepository.findActiveByUserId.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute(authUser)).rejects.toThrow(new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE));
    });
  });
});
