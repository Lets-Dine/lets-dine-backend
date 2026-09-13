// application/use-cases/__tests__/{action}-{feature-name}.usecase.test.ts
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@holista/core/exceptions";
import { AuthEntity } from "@holista/core/interfaces";
import { {Action}{Feature}Usecase } from "../{action}-{feature-name}.usecase";
import { {Feature}Repository } from "../../../domain/repositories/{feature-name}.repository";
import { {FEATURE}_ERROR_MESSAGES } from "../../../domain/constants";

const authUser: AuthEntity = { sub: 1, username: "test" } as AuthEntity;

describe("{Action}{Feature}Usecase", () => {
  let usecase: {Action}{Feature}Usecase;
  let {feature}Repository: jest.Mocked<{Feature}Repository>;
  let pubsubService: jest.Mocked<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {Action}{Feature}Usecase,
        { provide: "PUB_SUB_SERVICE", useValue: { publish: jest.fn() } },
        {
          provide: {Feature}Repository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    usecase = module.get({Action}{Feature}Usecase);
    {feature}Repository = module.get({Feature}Repository);
    pubsubService = module.get("PUB_SUB_SERVICE");
  });

  describe("execute", () => {
    it("should update the {feature} and publish an event", async () => {
      // Arrange
      const id = 1;
      const dto = {} as any;
      {feature}Repository.findById.mockResolvedValue({ id } as any);
      {feature}Repository.update.mockResolvedValue({ id, ...dto } as any);

      // Act
      const result = await usecase.execute(id, dto, authUser);

      // Assert
      expect(result).toEqual({ id, ...dto });
      expect({feature}Repository.update).toHaveBeenCalledWith(id, dto);
      expect(pubsubService.publish).toHaveBeenCalledWith("{feature}.updated", { id, authUser });
    });

    it("should throw NotFoundException when the {feature} does not exist", async () => {
      // Arrange
      {feature}Repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute(999, {} as any, authUser)).rejects.toThrow(
        new NotFoundException({FEATURE}_ERROR_MESSAGES.NOT_FOUND)
      );
      expect({feature}Repository.update).not.toHaveBeenCalled();
    });
  });
});
