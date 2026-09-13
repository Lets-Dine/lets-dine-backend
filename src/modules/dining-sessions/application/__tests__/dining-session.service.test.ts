import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "../../../../common/exceptions";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { DiningSessionService } from "../dining-session.service";

describe("DiningSessionService", () => {
  let service: DiningSessionService;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiningSessionService, { provide: DiningSessionRepository, useValue: { findByToken: jest.fn() } }],
    }).compile();

    service = module.get(DiningSessionService);
    diningSessionRepository = module.get(DiningSessionRepository);
  });

  describe("resolveActive", () => {
    it("should return a live session", async () => {
      // Arrange
      const session = { id: "session-1", expiresAt: new Date(Date.now() + 60_000), endedAt: null } as any;
      diningSessionRepository.findByToken.mockResolvedValue(session);

      // Act
      const result = await service.resolveActive("token");

      // Assert
      expect(result).toBe(session);
    });

    it("should throw UnauthorizedException for an unknown token", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw UnauthorizedException once the session has expired", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-1",
        expiresAt: new Date(Date.now() - 1),
        endedAt: null,
      } as any);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });

    it("should throw UnauthorizedException once the table has been closed out", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: new Date(),
      } as any);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });
  });
});
