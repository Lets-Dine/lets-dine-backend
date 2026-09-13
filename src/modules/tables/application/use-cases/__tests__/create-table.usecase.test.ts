import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningTableRepository } from "../../../domain/repositories/dining-table.repository";
import { CreateTableUsecase } from "../create-table.usecase";

const authUser = buildAuthEntity();

describe("CreateTableUsecase", () => {
  let usecase: CreateTableUsecase;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTableUsecase,
        { provide: DiningTableRepository, useValue: { findByName: jest.fn(), create: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateTableUsecase);
    diningTableRepository = module.get(DiningTableRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should create the table with a freshly generated QR token", async () => {
      // Arrange
      const table = { id: "table-1", name: "T1", capacity: 4 } as any;
      diningTableRepository.findByName.mockResolvedValue(null);
      diningTableRepository.create.mockResolvedValue(table);

      // Act
      const result = await usecase.execute({ name: "T1", capacity: 4 }, authUser);

      // Assert
      expect(result).toBe(table);
      expect(diningTableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "T1",
          restaurantId: authUser.restaurantId,
          qrToken: expect.stringMatching(/^[\w-]{32}$/),
        }),
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.table_created, subject: "T1" }),
        authUser
      );
    });

    it("should throw ConflictException when the name is already used", async () => {
      // Arrange
      diningTableRepository.findByName.mockResolvedValue({ id: "table-9" } as any);

      // Act & Assert
      await expect(usecase.execute({ name: "T1" }, authUser)).rejects.toThrow(
        new ConflictException(DINING_TABLE_ERROR_MESSAGES.NAME_ALREADY_EXISTS)
      );
      expect(diningTableRepository.create).not.toHaveBeenCalled();
    });
  });
});
