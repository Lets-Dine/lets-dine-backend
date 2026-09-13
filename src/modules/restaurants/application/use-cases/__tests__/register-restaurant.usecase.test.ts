import { Test, TestingModule } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { ConflictException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { RestaurantMemberRepository } from "../../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../../users/domain/repositories/user.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../domain/constants";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { RegisterRestaurantUsecase } from "../register-restaurant.usecase";

const dto = {
  name: "Newa Kitchen",
  slug: "newa-kitchen",
  owner: { name: "Aarati Shrestha", email: "aarati@lets-dine.test", pin: "4821" },
};

describe("RegisterRestaurantUsecase", () => {
  let usecase: RegisterRestaurantUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterRestaurantUsecase,
        {
          provide: RestaurantRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn({} as PrismaTransaction)),
            findBySlug: jest.fn(),
            create: jest.fn(),
          },
        },
        { provide: UserRepository, useValue: { findByEmail: jest.fn(), create: jest.fn() } },
        { provide: RestaurantMemberRepository, useValue: { create: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(RegisterRestaurantUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    userRepository = module.get(UserRepository);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
  });

  describe("execute", () => {
    it("should create the restaurant, its owner account and the membership in one transaction", async () => {
      // Arrange
      const restaurant = { id: "restaurant-1", name: dto.name } as any;
      const member = { id: "member-1", role: StaffRole.OWNER } as any;
      restaurantRepository.findBySlug.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      restaurantRepository.create.mockResolvedValue(restaurant);
      userRepository.create.mockResolvedValue({ id: "user-1" } as any);
      restaurantMemberRepository.create.mockResolvedValue(member);

      // Act
      const result = await usecase.execute(dto);

      // Assert
      expect(result).toEqual({ restaurant, owner: member });
      expect(restaurantRepository.create).toHaveBeenCalledWith(
        { name: dto.name, slug: dto.slug },
        expect.objectContaining({ tx: expect.anything() })
      );
      expect(restaurantMemberRepository.create).toHaveBeenCalledWith(
        { userId: "user-1", restaurantId: restaurant.id, role: StaffRole.OWNER },
        expect.anything()
      );
    });

    it("should throw ConflictException when the slug is taken", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-9" } as any);

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new ConflictException(RESTAURANT_ERROR_MESSAGES.SLUG_ALREADY_EXISTS));
      expect(restaurantRepository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the owner email already has an account", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue({ id: "user-9" } as any);

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new ConflictException(RESTAURANT_ERROR_MESSAGES.OWNER_EMAIL_ALREADY_EXISTS));
      expect(restaurantRepository.create).not.toHaveBeenCalled();
    });
  });
});
