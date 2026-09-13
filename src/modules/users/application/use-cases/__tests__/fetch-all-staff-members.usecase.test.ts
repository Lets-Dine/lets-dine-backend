import { Test, TestingModule } from "@nestjs/testing";
import { StaffRole } from "@prisma/client";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantMemberRepository } from "../../../domain/repositories/restaurant-member.repository";
import { FetchAllStaffMembersUsecase } from "../fetch-all-staff-members.usecase";

const authUser = buildAuthEntity();

describe("FetchAllStaffMembersUsecase", () => {
  let usecase: FetchAllStaffMembersUsecase;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchAllStaffMembersUsecase, { provide: RestaurantMemberRepository, useValue: { fetchAll: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchAllStaffMembersUsecase);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
  });

  describe("execute", () => {
    it("should split the filters from the pagination options and scope by token", async () => {
      // Arrange
      const page = { rows: [], count: 0 };
      restaurantMemberRepository.fetchAll.mockResolvedValue(page);

      // Act
      const result = await usecase.execute(
        { keyword: "rai", role: StaffRole.STAFF, isActive: true, limit: 10, returnData: true, returnCount: true },
        authUser
      );

      // Assert
      expect(result).toBe(page);
      expect(restaurantMemberRepository.fetchAll).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId, keyword: "rai", role: StaffRole.STAFF, isActive: true },
        { limit: 10, returnData: true, returnCount: true }
      );
    });
  });
});
