import { Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { CustomerRepository } from "../../../customers/domain/repositories/customer.repository";
import { EndDiningSessionUsecase } from "../../../dining-sessions/application/use-cases/end-dining-session.usecase";
import { StartTableSessionUsecase } from "../../../dining-sessions/application/use-cases/start-table-session.usecase";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../dining-sessions/domain/constants";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { generateSessionToken, sessionExpiryFrom } from "../../../dining-sessions/domain/utils/session-token.util";
import { isUniqueViolation } from "../../../payments/domain/utils/unique-violation.util";
import { FLOOR_ERROR_MESSAGES } from "../../../floors/domain/constants";
import { FloorRepository } from "../../../floors/domain/repositories/floor.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { CreateStaffOrderInput } from "../../interfaces/http/validations/create-staff-order.validation";
import { CreateOrderUsecase } from "./create-order.usecase";
import { UpdateOrderStatusUsecase } from "./update-order-status.usecase";

const DEFAULT_TTL_MINUTES = 180;

/**
 * Staff placing an order at the till, for a table, a floor or a delivery. Staff have no diner
 * session, so this finds (or opens) the one the order belongs in and hands off to
 * `CreateOrderUsecase` — the same pricing, validation and idempotency as a diner's checkout.
 *
 * A table reuses its open visit, or is seated now if it has none; a floor or delivery order
 * always starts its own session, the same as a fresh scan or phone number would. Staff placed
 * it themselves, so it is accepted on the spot and goes straight to the kitchen.
 */
@Injectable()
export class CreateStaffOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly floorRepository: FloorRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly startTableSessionUsecase: StartTableSessionUsecase,
    private readonly endDiningSessionUsecase: EndDiningSessionUsecase,
    private readonly createOrderUsecase: CreateOrderUsecase,
    private readonly updateOrderStatusUsecase: UpdateOrderStatusUsecase
  ) {}

  async execute(dto: CreateStaffOrderInput, authEntity: AuthEntity, options?: { idempotencyKey?: string }): Promise<IOrderWithItems> {
    // Before any session is opened — a retried tap must not leave an empty floor/delivery visit behind.
    const alreadyPlaced = await this.replayOf(options?.idempotencyKey, authEntity);
    if (alreadyPlaced) return this.accept(alreadyPlaced, authEntity);

    const { session, opened, deliveryAddress } = await this.sessionFor(dto, authEntity);
    // Delivery may have fallen back to the customer's saved address; the order stores what was actually used.
    const input = deliveryAddress ? { ...dto, deliveryAddress } : dto;

    let order: IOrderWithItems;
    try {
      order = await this.createOrderUsecase.execute(input, session, { idempotencyKey: options?.idempotencyKey, placedByStaff: true });
    } catch (error) {
      // The same tap, racing itself: the other request's order is the answer to this one too.
      const raced = isUniqueViolation(error) ? await this.replayOf(options?.idempotencyKey, authEntity) : null;
      // A visit this call opened and then couldn't put anything on — undo it, or the table reads as occupied.
      if (opened) await this.closeEmpty(session, authEntity).catch(() => undefined);
      if (raced) return this.accept(raced, authEntity);
      throw error;
    }

    return this.accept(order, authEntity);
  }

  private async replayOf(idempotencyKey: string | undefined, authEntity: AuthEntity): Promise<IOrderWithItems | null> {
    if (!idempotencyKey) return null;
    const order = await this.orderRepository.findByIdempotencyKey(idempotencyKey);
    if (order && !isInActiveBranch(authEntity, order)) throw new ConflictException(ORDER_ERROR_MESSAGES.IDEMPOTENCY_KEY_REUSED);
    return order;
  }

  /**
   * Staff placed it, so it goes straight to the kitchen. The order is already committed by now: if
   * accepting fails (someone accepted it on the pass first), it still exists — hand back its current state.
   */
  private async accept(order: IOrderWithItems, authEntity: AuthEntity): Promise<IOrderWithItems> {
    if (order.status !== OrderStatus.PENDING) return order;
    try {
      return await this.updateOrderStatusUsecase.execute(order.id, { status: OrderStatus.ACCEPTED }, authEntity);
    } catch {
      return (await this.orderRepository.findById(order.id)) ?? order;
    }
  }

  private async sessionFor(
    dto: CreateStaffOrderInput,
    authEntity: AuthEntity
  ): Promise<{ session: IDiningSession; opened: boolean; deliveryAddress?: string }> {
    if (dto.type === "TABLE") {
      const tableId = dto.tableId as string;
      const open = await this.diningSessionRepository.findOpenByTableId(tableId);
      if (open) {
        if (!isInActiveBranch(authEntity, open)) throw new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND);
        return { session: open, opened: false };
      }
      let opened = true;
      try {
        await this.startTableSessionUsecase.execute(tableId, authEntity);
      } catch (error) {
        // Someone seated it a moment ago (a scan, another till) — join that visit instead.
        const occupied = error instanceof ConflictException && error.exception.key === DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED.key;
        if (!occupied) throw error;
        opened = false;
      }
      const session = await this.diningSessionRepository.findOpenByTableId(tableId);
      if (!session) throw new NotFoundException(ORDER_ERROR_MESSAGES.NO_OPEN_VISIT_FOR_TABLE);
      return { session, opened };
    }

    if (dto.type === "FLOOR") {
      const floor = await this.floorRepository.findById(dto.floorId as string);
      if (!floor || !floor.isActive || !isInActiveBranch(authEntity, floor)) throw new NotFoundException(FLOOR_ERROR_MESSAGES.NOT_FOUND);
      return { session: await this.newSession(authEntity, { floorId: floor.id }), opened: true };
    }

    // Delivery: the phone number is the customer. A known one keeps their name and saved address — an address
    // typed here is for this one order only; a new one is saved with what staff typed.
    const customer = dto.customer as NonNullable<CreateStaffOrderInput["customer"]>;
    const existing = await this.customerRepository.findByPhone(authEntity.restaurantId, customer.phone.trim());
    const address = dto.deliveryAddress?.trim() || existing?.defaultAddress;
    if (!address) throw new BadRequestException(ORDER_ERROR_MESSAGES.DELIVERY_ADDRESS_REQUIRED);
    const saved =
      existing ??
      (await this.customerRepository.upsert({
        restaurantId: authEntity.restaurantId,
        phone: customer.phone.trim(),
        name: customer.name.trim(),
        defaultAddress: address,
      }));
    return { session: await this.newSession(authEntity, { customerId: saved.id }), opened: true, deliveryAddress: address };
  }

  private newSession(authEntity: AuthEntity, target: { floorId?: string; customerId?: string }): Promise<IDiningSession> {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    const ttl = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
    return this.diningSessionRepository.create({
      restaurantId: authEntity.restaurantId,
      branchId: authEntity.branchId,
      tableId: null,
      ...target,
      anonymousSessionToken: generateSessionToken(),
      expiresAt: sessionExpiryFrom(new Date(), ttl),
    });
  }

  /**
   * Only ever ends a visit that is still the one this call opened and still has nothing on it — a diner
   * may have scanned and ordered in between, and ending the visit would cancel their order.
   * ponytail: check-then-end isn't under the table lock; take it inside EndDiningSessionUsecase if this window ever bites.
   */
  private async closeEmpty(session: IDiningSession, authEntity: AuthEntity): Promise<void> {
    const orders = await this.orderRepository.findBySessionId(session.id, authEntity.restaurantId, authEntity.branchId);
    if (orders.length > 0) return;
    if (!session.tableId) return void (await this.diningSessionRepository.update(session.id, { endedAt: new Date() }));
    const current = await this.diningSessionRepository.findOpenByTableId(session.tableId);
    if (current?.id === session.id) await this.endDiningSessionUsecase.execute(session.tableId, authEntity);
  }
}
