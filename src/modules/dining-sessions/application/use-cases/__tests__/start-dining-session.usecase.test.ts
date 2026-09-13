import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { StartDiningSessionUsecase } from "../start-dining-session.usecase";

const dto = { restaurantSlug: "newa-kitchen", tableToken: "printed-token" };
const restaurant = { id: "restaurant-1", isActive: true } as any;
const table = { id: "table-1", restaurantId: "restaurant-1", isActive: true } as any;

describe("StartDiningSessionUsecase", () => {
  let usecase: StartDiningSessionUsecase;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartDiningSessionUsecase,
        { provide: DiningSessionRepository, useValue: { create: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: DiningTableRepository, useValue: { findByQrToken: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(StartDiningSessionUsecase);
    diningSessionRepository = module.get(DiningSessionRepository);
    restaurantRepository = module.get(RestaurantRepository);
    diningTableRepository = module.get(DiningTableRepository);
  });

  describe("execute", () => {
    it("should open a session with an expiry and return the resolved context", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue(table);
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);

      // Act
      const result = await usecase.execute(dto);

      // Assert
      expect(result).toEqual({ session: { id: "session-1" }, restaurant, table });
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created.anonymousSessionToken).toHaveLength(43);
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should throw NotFoundException when the restaurant is unknown or closed", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ ...restaurant, isActive: false });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the table code is disabled", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue({ ...table, isActive: false });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND));
    });

    it("should refuse a table code printed for a different restaurant", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue({ ...table, restaurantId: "restaurant-9" });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND));
    });
  });
});
