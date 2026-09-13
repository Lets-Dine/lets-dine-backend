import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StaffRole } from "@prisma/client";
import { ConflictException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { STAFF_MEMBER_ERROR_MESSAGES } from "../../../domain/constants";
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
      ],
    }).compile();

    usecase = module.get(CreateStaffMemberUsecase);
    userRepository = module.get(UserRepository);
    restaurantMemberRepository = module.get(RestaurantMemberRepository);
    auditLogService = module.get(AuditLogService);
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
        { userId: "user-1", restaurantId: authUser.restaurantId, role: dto.role },
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
        { userId: "user-9", restaurantId: authUser.restaurantId, role: dto.role },
        expect.anything()
      );
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
