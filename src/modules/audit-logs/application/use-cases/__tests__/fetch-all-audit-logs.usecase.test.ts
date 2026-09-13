import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogRepository } from "../../../domain/repositories/audit-log.repository";
import { FetchAllAuditLogsUsecase } from "../fetch-all-audit-logs.usecase";

const authUser = buildAuthEntity();

describe("FetchAllAuditLogsUsecase", () => {
  let usecase: FetchAllAuditLogsUsecase;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchAllAuditLogsUsecase, { provide: AuditLogRepository, useValue: { create: jest.fn(), fetchAll: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchAllAuditLogsUsecase);
    auditLogRepository = module.get(AuditLogRepository);
  });

  describe("execute", () => {
    it("should scope the query to the restaurant on the token, not one from the client", async () => {
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
          action: AuditAction.price_changed,
          actorId: undefined,
          from: undefined,
          to: undefined,
        },
        { limit: 20, offset: 0, returnData: true, returnCount: true }
      );
    });
  });
});
