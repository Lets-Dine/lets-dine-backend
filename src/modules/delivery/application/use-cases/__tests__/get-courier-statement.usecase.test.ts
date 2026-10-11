import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { GetCourierStatementUsecase, parseStatementCursor } from "../get-courier-statement.usecase";

const authUser = buildAuthEntity();
const PARTNER_ID = "66666666-6666-4666-8666-666666666666";
const CURSOR_ID = "77777777-7777-4777-8777-777777777777";

describe("parseStatementCursor", () => {
  it("should read back what a page hands out", () => {
    // Act
    const cursor = parseStatementCursor(`2026-10-10T08:30:00.000Z|1|${CURSOR_ID}`);

    // Assert
    expect(cursor).toEqual({ at: new Date("2026-10-10T08:30:00.000Z"), rank: 1, id: CURSOR_ID });
  });

  it.each(["", "nonsense", "2026-10-10T08:30:00.000Z|2|abc", "not-a-date|0|abc", "2026-10-10T08:30:00.000Z|0"])("should refuse %p", raw => {
    // Act + Assert
    expect(parseStatementCursor(raw)).toBeNull();
  });
});

describe("GetCourierStatementUsecase", () => {
  describe("execute", () => {
    it("should ask the repository for one page in the caller's branch", async () => {
      // Arrange
      const page = { entries: [], nextCursor: null };
      const repo = { fetchStatement: jest.fn().mockResolvedValue(page) };
      const usecase = new GetCourierStatementUsecase(repo as unknown as DeliveryRepository);

      // Act
      const result = await usecase.execute("PARTNER", PARTNER_ID, { limit: 30 }, authUser);

      // Assert
      expect(repo.fetchStatement).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId, branchId: authUser.branchId },
        "PARTNER",
        PARTNER_ID,
        { limit: 30, cursor: undefined }
      );
      expect(result).toBe(page);
    });

    it("should reject a cursor it did not hand out", async () => {
      // Arrange
      const repo = { fetchStatement: jest.fn() };
      const usecase = new GetCourierStatementUsecase(repo as unknown as DeliveryRepository);

      // Act + Assert
      await expect(usecase.execute("RIDER", PARTNER_ID, { limit: 30, cursor: "garbage" }, authUser)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(repo.fetchStatement).not.toHaveBeenCalled();
    });

    it("should say not found when the courier isn't in this branch", async () => {
      // Arrange
      const repo = { fetchStatement: jest.fn().mockResolvedValue(null) };
      const usecase = new GetCourierStatementUsecase(repo as unknown as DeliveryRepository);

      // Act + Assert
      await expect(usecase.execute("RIDER", PARTNER_ID, { limit: 30 }, authUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
