import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { FloorRepository } from "../../../../floors/domain/repositories/floor.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { StartFloorSessionUsecase } from "../start-floor-session.usecase";

const dto = { restaurantSlug: "newa-kitchen", floorToken: "floor-token-12345", visitorName: "Cabin A" };
const restaurant = { id: "restaurant-1", isActive: true } as any;
const floor = { id: "floor-1", restaurantId: "restaurant-1", name: "3rd Floor", isActive: true } as any;

describe("StartFloorSessionUsecase", () => {
  let usecase: StartFloorSessionUsecase;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let floorRepository: jest.Mocked<FloorRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartFloorSessionUsecase,
        { provide: DiningSessionRepository, useValue: { create: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: FloorRepository, useValue: { findByQrToken: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(StartFloorSessionUsecase);
    diningSessionRepository = module.get(DiningSessionRepository);
    restaurantRepository = module.get(RestaurantRepository);
    floorRepository = module.get(FloorRepository);

    restaurantRepository.findBySlug.mockResolvedValue(restaurant);
    floorRepository.findByQrToken.mockResolvedValue(floor);
  });

  describe("execute", () => {
    it("should open a table-less, floor-scoped session carrying the visitor's own name", async () => {
      // Arrange
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);

      // Act
      const result = await usecase.execute(dto);

      // Assert
      expect(result).toEqual({ session: { id: "session-1" }, restaurant, table: null, floor });
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created).toMatchObject({
        restaurantId: floor.restaurantId,
        tableId: null,
        floorId: floor.id,
        floorVisitorName: "Cabin A",
      });
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should trim the visitor name before storing it", async () => {
      // Arrange
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);

      // Act
      await usecase.execute({ ...dto, visitorName: "  Rajesh  " });

      // Assert
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created.floorVisitorName).toBe("Rajesh");
    });

    it("should start a brand-new session on every scan, never joining a prior one from the same QR", async () => {
      // Arrange — the whole point of a floor QR: no `currentSessionId` singleton to join against.
      diningSessionRepository.create.mockResolvedValueOnce({ id: "session-1" } as any).mockResolvedValueOnce({ id: "session-2" } as any);

      // Act
      const first = await usecase.execute(dto);
      const second = await usecase.execute(dto);

      // Assert
      expect(first.session.id).not.toBe(second.session.id);
      expect(diningSessionRepository.create).toHaveBeenCalledTimes(2);
    });

    it("should throw NotFoundException when the restaurant is unknown or closed", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ ...restaurant, isActive: false });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
      expect(floorRepository.findByQrToken).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for an unknown, inactive, or cross-restaurant floor token", async () => {
      // Arrange
      floorRepository.findByQrToken.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(DINING_SESSION_ERROR_MESSAGES.FLOOR_NOT_FOUND));
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the floor belongs to a different restaurant", async () => {
      // Arrange
      floorRepository.findByQrToken.mockResolvedValue({ ...floor, restaurantId: "restaurant-9" });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(DINING_SESSION_ERROR_MESSAGES.FLOOR_NOT_FOUND));
    });
  });
});
