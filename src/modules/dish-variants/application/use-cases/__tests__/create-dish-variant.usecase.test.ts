import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { DishVariantRepository } from "../../../domain/repositories/dish-variant.repository";
import { CreateDishVariantUsecase } from "../create-dish-variant.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, name: "BBQ Pizza" };
const dto = { name: "Large", price: 65000 };

describe("CreateDishVariantUsecase", () => {
  let usecase: CreateDishVariantUsecase;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDishVariantUsecase,
        { provide: DishVariantRepository, useValue: { create: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateDishVariantUsecase);
    dishVariantRepository = module.get(DishVariantRepository);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);

    dishRepository.findById.mockResolvedValue(dish as any);
  });

  describe("execute", () => {
    it("should create the variant scoped to the dish", async () => {
      // Arrange
      dishVariantRepository.create.mockResolvedValue({ id: "variant-1", dishId: dish.id, name: dto.name } as any);

      // Act
      const result = await usecase.execute(dish.id, dto, authUser);

      // Assert
      expect(result.id).toBe("variant-1");
      expect(dishVariantRepository.create).toHaveBeenCalledWith(expect.objectContaining({ ...dto, dishId: dish.id }), {
        actorId: authUser.sub,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_variant_created, subject: `${dish.name} — ${dto.name}` }),
        authUser
      );
    });

    it("should throw NotFoundException when the dish belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ ...dish, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, dto, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
      expect(dishVariantRepository.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when there is no such dish", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute(dish.id, dto, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
      expect(dishVariantRepository.create).not.toHaveBeenCalled();
    });
  });
});
