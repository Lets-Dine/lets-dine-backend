import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { DiningSessionService } from "../../dining-session.service";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { EndDiningSessionUsecase } from "../end-dining-session.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;

describe("EndDiningSessionUsecase", () => {
  let usecase: EndDiningSessionUsecase;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let diningSessionService: jest.Mocked<DiningSessionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndDiningSessionUsecase,
        {
          provide: DiningTableRepository,
          useValue: { findById: jest.fn(), lockById: jest.fn(), $transaction: jest.fn(fn => fn(tx)) },
        },
        { provide: DiningSessionRepository, useValue: { findOpenByTableId: jest.fn() } },
        { provide: DiningSessionService, useValue: { endSession: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(EndDiningSessionUsecase);
    diningTableRepository = module.get(DiningTableRepository);
    diningSessionRepository = module.get(DiningSessionRepository);
    diningSessionService = module.get(DiningSessionService);
  });

  describe("execute", () => {
    it("should hand the open session off to the shared end-session service", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue({ id: "table-1", restaurantId: authUser.restaurantId, name: "T1" } as any);
      const session = { id: "session-1", tableId: "table-1", endedAt: null };
      diningSessionRepository.findOpenByTableId.mockResolvedValue(session as any);
      const updatedTable = { id: "table-1", currentSessionId: null };
      diningSessionService.endSession.mockResolvedValue(updatedTable as any);

      // Act
      const result = await usecase.execute("table-1", authUser);

      // Assert
      expect(result).toBe(updatedTable);
      expect(diningSessionService.endSession).toHaveBeenCalledWith(session, authUser, tx);
    });

    it("should throw NotFoundException when the table is not this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(
        new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND)
      );
      expect(diningSessionRepository.findOpenByTableId).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the table has no open session", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue({ id: "table-1", restaurantId: authUser.restaurantId, name: "T1" } as any);
      diningSessionRepository.findOpenByTableId.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", authUser)).rejects.toThrow(
        new NotFoundException(DINING_SESSION_ERROR_MESSAGES.NO_ACTIVE_SESSION)
      );
      expect(diningSessionService.endSession).not.toHaveBeenCalled();
    });
  });
});
