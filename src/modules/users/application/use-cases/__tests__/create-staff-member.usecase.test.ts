import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StaffRole } from "@prisma/client";
import { BadRequestException, ConflictException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../../domain/constants";
import { BranchRepository } from "../../../../branches/domain/repositories/branch.repository";
import { RestaurantMemberRepository } from "../../../domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../domain/repositories/user.repository";
import { CreateStaffMemberUsecase } from "../create-staff-member.usecase";

const authUser = buildAuthEntity();
const dto = { name: "Bikash Rai", email: "bikash@lets-dine.test", pin: "4821", role: StaffRole.STAFF };

describe("CreateStaffMemberUsecase", () => {
  let usecase: CreateStaffMemberUsecase;
  let userRepository: jest.Mocked<UserRepository>;
  let restaurantMemberRepository: jest.Mocked<RestaurantMemberRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let branchRepository: jest.Mocked<BranchRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateStaffMemberUsecase,
        {
          provide: UserRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn({} as PrismaTransaction)),
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: RestaurantMemberRepository,
          useValue: { findByUserAndRestaurant: jest.fn(), create: jest.fn() },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        {
          provide: BranchRepository,
          useValue: { findActiveByIds: jest.fn().mockImplementation((_r: string, ids: string[]) => Promise.resolve(ids.map(id => ({ id })))) },
        },
      ],
    }).compile();

    usecase = module.get(CreateStaffMemberUsecase);
    userRepository = module.get(UserRepository);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
    auditLogService = module.get(AuditLogService);
    branchRepository = module.get(BranchRepository);
  });

  describe("execute", () => {
    it("should create the user and the membership, and record the action", async () => {
      // Arrange
      const member = { id: "member-1", name: dto.name, role: dto.role } as any;
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ id: "user-1" } as any);
      restaurantMemberRepository.create.mockResolvedValue(member);

      // Act
      const result = await usecase.execute(dto, authUser);

      // Assert
      expect(result).toBe(member);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, name: dto.name, pinHash: expect.stringContaining(":") }),
        expect.objectContaining({ actorId: authUser.sub })
      );
      expect(restaurantMemberRepository.create).toHaveBeenCalledWith(
        { userId: "user-1", restaurantId: authUser.restaurantId, role: dto.role, branchIds: [authUser.branchId] },
        expect.anything()
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.staff_invited, subject: dto.name }),
        authUser
      );
    });

    it("should reuse an existing account rather than creating a second one", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-9" } as any);
      restaurantMemberRepository.findByUserAndRestaurant.mockResolvedValue(null);
      restaurantMemberRepository.create.mockResolvedValue({ id: "member-2", name: dto.name, role: dto.role } as any);

      // Act
      await usecase.execute(dto, authUser);

      // Assert
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(restaurantMemberRepository.create).toHaveBeenCalledWith(
        { userId: "user-9", restaurantId: authUser.restaurantId, role: dto.role, branchIds: [authUser.branchId] },
        expect.anything()
      );
    });

    it("should pin a non-owner to the requested branches", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ id: "user-1" } as any);
      restaurantMemberRepository.create.mockResolvedValue({ id: "member-1", name: dto.name, role: dto.role } as any);

      // Act
      await usecase.execute({ ...dto, branchIds: ["branch-a", "branch-b"] }, authUser);

      // Assert
      expect(restaurantMemberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchIds: ["branch-a", "branch-b"] }),
        expect.anything()
      );
    });

    it("should not assign branches to an OWNER", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ id: "user-1" } as any);
      restaurantMemberRepository.create.mockResolvedValue({ id: "member-1", name: dto.name, role: StaffRole.OWNER } as any);

      // Act
      await usecase.execute({ ...dto, role: StaffRole.OWNER }, authUser);

      // Assert
      expect(branchRepository.findActiveByIds).not.toHaveBeenCalled();
      expect(restaurantMemberRepository.create).toHaveBeenCalledWith(expect.objectContaining({ branchIds: undefined }), expect.anything());
    });

    it("should reject a branch that is not an active branch of this restaurant", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);
      branchRepository.findActiveByIds.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ ...dto, branchIds: ["foreign"] }, authUser)).rejects.toThrow(
        new BadRequestException(STAFF_MEMBER_ERROR_MESSAGES.INVALID_BRANCHES)
      );
      expect(restaurantMemberRepository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the person is already on this team", async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: "user-9" } as any);
      restaurantMemberRepository.findByUserAndRestaurant.mockResolvedValue({ id: "member-3" } as any);

      // Act & Assert
      await expect(usecase.execute(dto, authUser)).rejects.toThrow(new ConflictException(STAFF_MEMBER_ERROR_MESSAGES.ALREADY_EXISTS));
      expect(restaurantMemberRepository.create).not.toHaveBeenCalled();
    });
  });
});
