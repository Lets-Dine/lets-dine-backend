import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { RESTAURANT_ERROR_MESSAGES } from "../../../domain/constants";
import { IRestaurant } from "../../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { UpdateRestaurantUsecase } from "../update-restaurant.usecase";

const authUser = buildAuthEntity();

function buildRestaurant(overrides: Partial<IRestaurant> = {}): IRestaurant {
  return {
    id: authUser.restaurantId,
    name: "Newa Kitchen",
    slug: "newa-kitchen",
    tagline: "",
    description: "",
    coverImageUrl: null,
    currency: "NPR",
    timezone: "Asia/Kathmandu",
    serviceChargeRate: 0.1,
    taxRate: 0.13,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("UpdateRestaurantUsecase", () => {
  let usecase: UpdateRestaurantUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateRestaurantUsecase,
        { provide: RestaurantRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateRestaurantUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should update the restaurant and record what changed", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(buildRestaurant());
      restaurantRepository.update.mockResolvedValue(buildRestaurant({ serviceChargeRate: 0.05 }));

      // Act
      const result = await usecase.execute({ serviceChargeRate: 0.05 }, authUser);

      // Assert
      expect(result.serviceChargeRate).toBe(0.05);
      expect(auditLogService.record).toHaveBeenCalledWith(
        { action: AuditAction.settings_updated, subject: "Newa Kitchen", detail: "serviceChargeRate: 0.1 → 0.05" },
        authUser
      );
    });

    it("should not record an audit entry when nothing actually changed", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(buildRestaurant());
      restaurantRepository.update.mockResolvedValue(buildRestaurant());

      // Act
      await usecase.execute({ name: "Newa Kitchen" }, authUser);

      // Assert
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the restaurant on the token is gone", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ name: "Whatever" }, authUser)).rejects.toThrow(
        new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(restaurantRepository.update).not.toHaveBeenCalled();
    });
  });
});
