import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { CustomerRepository } from "../../../../customers/domain/repositories/customer.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../domain/constants";
import { DiningSessionRepository } from "../../../domain/repositories/dining-session.repository";
import { StartDeliverySessionUsecase } from "../start-delivery-session.usecase";

const dto = { restaurantSlug: "newa-kitchen", phone: "9800000000", name: "Hari Gurung", address: "Baneshwor, Kathmandu" };
const restaurant = { id: "restaurant-1", isActive: true } as any;
const customer = {
  id: "customer-1",
  restaurantId: "restaurant-1",
  phone: "9800000000",
  name: "Hari Gurung",
  defaultAddress: "Baneshwor, Kathmandu",
  defaultNote: null,
};

describe("StartDeliverySessionUsecase", () => {
  let usecase: StartDeliverySessionUsecase;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartDeliverySessionUsecase,
        { provide: DiningSessionRepository, useValue: { create: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: CustomerRepository, useValue: { findByPhone: jest.fn(), upsert: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(StartDeliverySessionUsecase);
    diningSessionRepository = module.get(DiningSessionRepository);
    restaurantRepository = module.get(RestaurantRepository);
    customerRepository = module.get(CustomerRepository);

    restaurantRepository.findBySlug.mockResolvedValue(restaurant);
  });

  describe("execute", () => {
    it("should open a table-less session for a new customer and return the resolved context", async () => {
      // Arrange
      customerRepository.findByPhone.mockResolvedValue(null);
      customerRepository.upsert.mockResolvedValue(customer as any);
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);

      // Act
      const result = await usecase.execute(dto);

      // Assert
      expect(result).toEqual({ session: { id: "session-1" }, restaurant, table: null, customer });
      expect(customerRepository.upsert).toHaveBeenCalledWith({
        restaurantId: restaurant.id,
        phone: dto.phone,
        name: dto.name,
        defaultAddress: dto.address,
        defaultNote: null,
      });
      const [created] = diningSessionRepository.create.mock.calls[0];
      expect(created).toMatchObject({ restaurantId: restaurant.id, tableId: null, customerId: customer.id });
      expect(created.anonymousSessionToken).toMatch(/^\d{8}$/);
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should prefill name/address from the existing customer on a repeat order", async () => {
      // Arrange
      customerRepository.findByPhone.mockResolvedValue(customer as any);
      customerRepository.upsert.mockResolvedValue(customer as any);
      diningSessionRepository.create.mockResolvedValue({ id: "session-1" } as any);

      // Act
      await usecase.execute({ restaurantSlug: dto.restaurantSlug, phone: dto.phone });

      // Assert
      expect(customerRepository.upsert).toHaveBeenCalledWith({
        restaurantId: restaurant.id,
        phone: dto.phone,
        name: customer.name,
        defaultAddress: customer.defaultAddress,
        defaultNote: customer.defaultNote,
      });
    });

    it("should throw BadRequestException when a first-time customer omits their name", async () => {
      // Arrange
      customerRepository.findByPhone.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ restaurantSlug: dto.restaurantSlug, phone: dto.phone })).rejects.toThrow(
        new BadRequestException(DINING_SESSION_ERROR_MESSAGES.CUSTOMER_NAME_REQUIRED)
      );
      expect(customerRepository.upsert).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the restaurant is unknown or closed", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ ...restaurant, isActive: false });

      // Act & Assert
      await expect(usecase.execute(dto)).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
      expect(customerRepository.findByPhone).not.toHaveBeenCalled();
    });
  });
});
