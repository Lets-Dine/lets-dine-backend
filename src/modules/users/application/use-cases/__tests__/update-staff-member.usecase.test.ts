import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../../domain/constants";
import { IStaffMember } from "../../../domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../domain/repositories/restaurant-member.repository";
import { UpdateStaffMemberUsecase } from "../update-staff-member.usecase";

const authUser = buildAuthEntity();

function buildMember(overrides: Partial<IStaffMember> = {}): IStaffMember {
  return {
    id: "member-1",
    userId: "user-1",
    restaurantId: authUser.restaurantId,
    role: StaffRole.STAFF,
    isActive: true,
    name: "Bikash Rai",
    email: "bikash@lets-dine.test",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("UpdateStaffMemberUsecase", () => {
  let usecase: UpdateStaffMemberUsecase;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateStaffMemberUsecase,
        {
          provide: RestaurantMemberRepository,
          useValue: { findById: jest.fn(), update: jest.fn(), countActiveByRole: jest.fn() },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateStaffMemberUsecase);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe("execute", () => {
    it("should update the role and record the change", async () => {
      // Arrange
      const member = buildMember();
      const updated = buildMember({ role: StaffRole.MANAGER });
      restaurantMemberRepository.findById.mockResolvedValue(member);
      restaurantMemberRepository.update.mockResolvedValue(updated);

      // Act
      const result = await usecase.execute(member.id, { role: StaffRole.MANAGER }, authUser);

      // Assert
      expect(result).toBe(updated);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.staff_role_changed, detail: "STAFF → MANAGER" }),
        authUser
      );
    });

    it("should record a deactivation", async () => {
      // Arrange
      const member = buildMember();
      restaurantMemberRepository.findById.mockResolvedValue(member);
      restaurantMemberRepository.update.mockResolvedValue(buildMember({ isActive: false }));

      // Act
      await usecase.execute(member.id, { isActive: false }, authUser);

      // Assert
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.staff_deactivated }), authUser);
    });

    it("should throw NotFoundException when the member belongs to another restaurant", async () => {
      // Arrange
      restaurantMemberRepository.findById.mockResolvedValue(buildMember({ restaurantId: "another-restaurant" }));

      // Act & Assert
      await expect(usecase.execute("member-1", { isActive: false }, authUser)).rejects.toThrow(
        new NotFoundException(STAFF_MEMBER_ERROR_MESSAGES.NOT_FOUND)
      );
      expect(restaurantMemberRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the member does not exist", async () => {
      // Arrange
      restaurantMemberRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("missing", { isActive: false }, authUser)).rejects.toThrow(
        new NotFoundException(STAFF_MEMBER_ERROR_MESSAGES.NOT_FOUND)
      );
    });

    it("should throw ForbiddenException when editing yourself", async () => {
      // Arrange
      restaurantMemberRepository.findById.mockResolvedValue(buildMember({ id: authUser.memberId }));

      // Act & Assert
      await expect(usecase.execute(authUser.memberId, { role: StaffRole.STAFF }, authUser)).rejects.toThrow(
        new ForbiddenException(STAFF_MEMBER_ERROR_MESSAGES.CANNOT_EDIT_SELF)
      );
    });

    it("should throw BadRequestException when removing the last active owner", async () => {
      // Arrange
      restaurantMemberRepository.findById.mockResolvedValue(buildMember({ role: StaffRole.OWNER }));
      restaurantMemberRepository.countActiveByRole.mockResolvedValue(1);

      // Act & Assert
      await expect(usecase.execute("member-1", { isActive: false }, authUser)).rejects.toThrow(
        new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.LAST_OWNER)
      );
      expect(restaurantMemberRepository.update).not.toHaveBeenCalled();
    });
  });
});
