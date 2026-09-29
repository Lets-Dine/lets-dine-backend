import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { AddOnRepository } from "../../../domain/repositories/add-on.repository";
import { CreateAddOnUsecase } from "../create-add-on.usecase";

const authUser = buildAuthEntity();
const dto = { name: "Extra Cheese", price: 5000 };

describe("CreateAddOnUsecase", () => {
  let usecase: CreateAddOnUsecase;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAddOnUsecase,
        { provide: AddOnRepository, useValue: { create: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateAddOnUsecase);
    addOnRepository = module.get(AddOnRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should create the add-on scoped to the actor's restaurant", async () => {
      // Arrange
      addOnRepository.create.mockResolvedValue({ id: "addon-1", name: dto.name } as any);

      // Act
      const result = await usecase.execute(dto, authUser);

      // Assert
      expect(result.id).toBe("addon-1");
      expect(addOnRepository.create).toHaveBeenCalledWith(expect.objectContaining({ ...dto, restaurantId: authUser.restaurantId }), {
        actorId: authUser.sub,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.addon_created, subject: dto.name }),
        authUser
      );
    });
  });
});
