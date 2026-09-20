import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { StartDiningSessionUsecase } from "../start-dining-session.usecase";

const dto = { restaurantSlug: "newa-kitchen", tableToken: "printed-token" };
const restaurant = { id: "restaurant-1", isActive: true } as any;
const table = {
  id: "table-1",
  restaurantId: "restaurant-1",
  currentSessionId: null,
  isActive: true,
} as any;
const tx = {} as any;

describe("StartDiningSessionUsecase", () => {
  let usecase: StartDiningSessionUsecase;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartDiningSessionUsecase,
        {
          provide: DiningSessionRepository,
          useValue: {
            create: jest.fn(),
            findOpenByTableId: jest.fn(),
            update: jest.fn(),
          },
        },
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        {
          provide: DiningTableRepository,
          useValue: {
            $transaction: jest.fn(),
            lockById: jest.fn(),
            findById: jest.fn(),
            findByQrToken: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    usecase = module.get(StartDiningSessionUsecase);
    diningSessionRepository = module.get(DiningSessionRepository);
    restaurantRepository = module.get(RestaurantRepository);
    diningTableRepository = module.get(DiningTableRepository);

    diningTableRepository.$transaction.mockImplementation(fn => fn(tx));
    diningTableRepository.findById.mockResolvedValue(table);
    diningTableRepository.update.mockImplementation(async (_id, data) => ({ ...table, ...data }));
    diningSessionRepository.findOpenByTableId.mockResolvedValue(null);
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
      expect(result).toEqual({
        session: { id: "session-1" },
        restaurant,
        table: { ...table, currentSessionId: "session-1" },
      });
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created.anonymousSessionToken).toHaveLength(43);
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(diningTableRepository.update).toHaveBeenCalledWith(table.id, { currentSessionId: "session-1" }, { tx });
    });

    it("should report an occupied table without revealing its active session", async () => {
      const active = {
        id: "session-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any;
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue(table);
      diningSessionRepository.findOpenByTableId.mockResolvedValue(active);

      await expect(usecase.execute(dto)).rejects.toThrow(new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED));
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should join only when the supplied id matches the active session", async () => {
      const active = {
        id: "9ec7521f-a8c9-4260-ae56-42a88e6d9f29",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any;
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue(table);
      diningSessionRepository.findOpenByTableId.mockResolvedValue(active);

      const result = await usecase.execute({ ...dto, joinSessionId: active.id });

      expect(result.session).toBe(active);
      expect(diningSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should reject a join id that does not match the active session", async () => {
      diningSessionRepository.findOpenByTableId.mockResolvedValue({
        id: "9ec7521f-a8c9-4260-ae56-42a88e6d9f29",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any);
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue(table);

      await expect(usecase.execute({ ...dto, joinSessionId: "b995dd4a-406a-49d0-a608-11509b69da7d" })).rejects.toThrow(
        new ConflictException(DINING_SESSION_ERROR_MESSAGES.JOIN_MISMATCH)
      );
    });

    it("should end an expired open session before creating a replacement", async () => {
      const expired = {
        id: "session-old",
        expiresAt: new Date(Date.now() - 1),
        endedAt: null,
      } as any;
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);
      diningTableRepository.findByQrToken.mockResolvedValue(table);
      diningSessionRepository.findOpenByTableId.mockResolvedValue(expired);
      diningSessionRepository.create.mockResolvedValue({ id: "session-new" } as any);

      await usecase.execute(dto);

      expect(diningSessionRepository.update).toHaveBeenCalledWith(expired.id, { endedAt: expect.any(Date) }, tx);
      expect(diningTableRepository.update).toHaveBeenCalledWith(table.id, { currentSessionId: "session-new" }, { tx });
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
