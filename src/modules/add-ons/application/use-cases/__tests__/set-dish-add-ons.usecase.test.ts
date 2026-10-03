import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { ADD_ON_ERROR_MESSAGES } from "../../../domain/constants";
import { AddOnRepository } from "../../../domain/repositories/add-on.repository";
import { SetDishAddOnsUsecase } from "../set-dish-add-ons.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Momo" };
const addOn = { id: "addon-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Extra Cheese" };

describe("SetDishAddOnsUsecase", () => {
  let usecase: SetDishAddOnsUsecase;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetDishAddOnsUsecase,
        { provide: AddOnRepository, useValue: { findManyByIds: jest.fn(), setDishLinks: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(SetDishAddOnsUsecase);
    addOnRepository = module.get(AddOnRepository);
    dishRepository = module.get(DishRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should replace the dish's linked add-ons", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(dish as any);
      addOnRepository.findManyByIds.mockResolvedValue([addOn] as any);

      // Act
      const result = await usecase.execute("dish-1", { addOnIds: ["addon-1"] }, authUser);

      // Assert
      expect(result).toEqual([addOn]);
      expect(addOnRepository.setDishLinks).toHaveBeenCalledWith("dish-1", ["addon-1"]);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.dish_add_ons_updated, subject: dish.name }),
        authUser
      );
    });

    it("should throw NotFoundException when the dish belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ ...dish, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute("dish-1", { addOnIds: [] }, authUser)).rejects.toThrow(
        new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(addOnRepository.setDishLinks).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when an add-on id belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(dish as any);
      addOnRepository.findManyByIds.mockResolvedValue([{ ...addOn, restaurantId: "other" }] as any);

      // Act & Assert
      await expect(usecase.execute("dish-1", { addOnIds: ["addon-1"] }, authUser)).rejects.toThrow(
        new BadRequestException(ADD_ON_ERROR_MESSAGES.INVALID_ADD_ON_IDS)
      );
      expect(addOnRepository.setDishLinks).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when an add-on id doesn't exist", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(dish as any);
      addOnRepository.findManyByIds.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute("dish-1", { addOnIds: ["addon-1"] }, authUser)).rejects.toThrow(
        new BadRequestException(ADD_ON_ERROR_MESSAGES.INVALID_ADD_ON_IDS)
      );
      expect(addOnRepository.setDishLinks).not.toHaveBeenCalled();
    });
  });
});
