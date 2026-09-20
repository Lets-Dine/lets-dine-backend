import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "../../../../common/exceptions";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { DiningSessionService } from "../dining-session.service";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { buildAuthEntity } from "../../../../common/testing";
import { AuditAction } from "@prisma/client";

const authUser = buildAuthEntity();
const tx = {} as any;
const session = { id: "session-1", tableId: "table-1" };

describe("DiningSessionService", () => {
  let service: DiningSessionService;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiningSessionService,
        { provide: DiningSessionRepository, useValue: { findByToken: jest.fn(), update: jest.fn() } },
        { provide: DiningTableRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: OrderRepository, useValue: { settleOpenBySessionId: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(DiningSessionService);
    diningSessionRepository = module.get(DiningSessionRepository);
    diningTableRepository = module.get(DiningTableRepository);
    orderRepository = module.get(OrderRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("resolveActive", () => {
    it("should return a live session", async () => {
      // Arrange
      const session = {
        id: "session-1",
        tableId: "table-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any;
      diningSessionRepository.findByToken.mockResolvedValue(session);
      diningTableRepository.findById.mockResolvedValue({ id: "table-1", currentSessionId: session.id } as any);

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

    it("should reject a live token that is no longer the table's current session", async () => {
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-old",
        tableId: "table-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any);
      diningTableRepository.findById.mockResolvedValue({
        id: "table-1",
        currentSessionId: "session-new",
      } as any);

      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });
  });

  describe("endSession", () => {
    it("should complete every open order, end the session, clear the table, and record it", async () => {
      // Arrange
      orderRepository.settleOpenBySessionId.mockResolvedValue(2);
      const table = { id: "table-1", name: "T1", currentSessionId: null };
      diningTableRepository.update.mockResolvedValue(table as any);

      // Act
      const result = await service.endSession(session as any, authUser, tx);

      // Assert
      expect(result).toBe(table);
      expect(orderRepository.settleOpenBySessionId).toHaveBeenCalledWith("session-1", authUser.restaurantId, { tx });
      expect(diningSessionRepository.update).toHaveBeenCalledWith("session-1", { endedAt: expect.any(Date) }, tx);
      expect(diningTableRepository.update).toHaveBeenCalledWith("table-1", { currentSessionId: null }, { tx });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.table_session_ended,
          subject: "T1",
          detail: expect.stringContaining("2 orders marked completed"),
        }),
        authUser,
        tx
      );
    });

    it("should not claim any orders were completed when none were open", async () => {
      // Arrange
      orderRepository.settleOpenBySessionId.mockResolvedValue(0);
      diningTableRepository.update.mockResolvedValue({ id: "table-1", name: "T1" } as any);

      // Act
      await service.endSession(session as any, authUser, tx);

      // Assert
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ detail: "Table cleared for the next visit" }),
        authUser,
        tx
      );
    });
  });
});
