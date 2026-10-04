import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { EntitlementService } from "../../../../billing/application/entitlement.service";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogRepository } from "../../../domain/repositories/audit-log.repository";
import { FetchAllAuditLogsUsecase } from "../fetch-all-audit-logs.usecase";

const authUser = buildAuthEntity();

describe("FetchAllAuditLogsUsecase", () => {
  let usecase: FetchAllAuditLogsUsecase;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let entitlementService: jest.Mocked<EntitlementService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchAllAuditLogsUsecase,
        { provide: EntitlementService, useValue: { getEntitlements: jest.fn().mockResolvedValue({ features: {} }) } },
        { provide: AuditLogRepository, useValue: { create: jest.fn(), fetchAll: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchAllAuditLogsUsecase);
    auditLogRepository = module.get(AuditLogRepository);
    entitlementService = module.get(EntitlementService);
    auditLogRepository.fetchAll.mockResolvedValue({ rows: [], count: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("execute", () => {
    it("should scope the query to the restaurant and the active branch on the token, not anything from the client", async () => {
      // Arrange
      const page = { rows: [], count: 0 };
      auditLogRepository.fetchAll.mockResolvedValue(page);

      // Act
      const result = await usecase.execute(
        { action: AuditAction.price_changed, limit: 20, offset: 0, returnData: true, returnCount: true },
        authUser
      );

      // Assert
      expect(result).toBe(page);
      expect(auditLogRepository.fetchAll).toHaveBeenCalledWith(
        {
          restaurantId: authUser.restaurantId,
          branchId: authUser.branchId,
          action: AuditAction.price_changed,
          actorId: undefined,
          from: undefined,
          to: undefined,
        },
        { limit: 20, offset: 0, returnData: true, returnCount: true }
      );
    });

    it("should not serve history older than the plan's retention window, however far back the client asks", async () => {
      // Arrange
      jest.useFakeTimers().setSystemTime(new Date("2026-03-31T12:00:00.000Z"));
      entitlementService.getEntitlements.mockResolvedValue({ features: { auditRetentionDays: 30 } } as any);

      // Act
      await usecase.execute(
        { from: new Date("2025-01-01T00:00:00.000Z"), limit: 20, offset: 0, returnData: true, returnCount: true },
        authUser
      );

      // Assert
      expect(auditLogRepository.fetchAll).toHaveBeenCalledWith(
        expect.objectContaining({ from: new Date("2026-03-01T12:00:00.000Z") }),
        expect.anything()
      );
    });

    it("should still honour a start date that is already inside the retention window", async () => {
      // Arrange
      jest.useFakeTimers().setSystemTime(new Date("2026-03-31T12:00:00.000Z"));
      entitlementService.getEntitlements.mockResolvedValue({ features: { auditRetentionDays: 30 } } as any);
      const from = new Date("2026-03-20T00:00:00.000Z");

      // Act
      await usecase.execute({ from, limit: 20, offset: 0, returnData: true, returnCount: true }, authUser);

      // Assert
      expect(auditLogRepository.fetchAll).toHaveBeenCalledWith(expect.objectContaining({ from }), expect.anything());
    });

    it("should read the plan of the token's restaurant", async () => {
      // Act
      await usecase.execute({ limit: 20, offset: 0, returnData: true, returnCount: true }, authUser);

      // Assert
      expect(entitlementService.getEntitlements).toHaveBeenCalledWith(authUser.restaurantId);
    });
  });
});
