import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { can } from "../../../../common/auth";
import { ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DiningSessionService } from "../../../dining-sessions/application/dining-session.service";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { calculateOrderTotals } from "../../../orders/domain/utils/money.util";
import { deriveOrderStatus } from "../../../orders/domain/utils/order-status.util";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { PAYMENT_ERROR_MESSAGES } from "../../domain/constants";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { IPaymentItemCreate, PaymentRepository } from "../../domain/repositories/payment.repository";
import { CompletePaymentInput } from "../../interfaces/http/validations/complete-payment.validation";

@Injectable()
export class CompletePaymentUsecase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly diningSessionService: DiningSessionService,
    private readonly dishRepository: DishRepository,
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly addOnRepository: AddOnRepository,
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(dto: CompletePaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    const [session, restaurant] = await Promise.all([
      this.diningSessionRepository.findById(dto.sessionId),
      this.restaurantRepository.findByIdForBranch(authEntity.restaurantId, authEntity.branchId),
    ]);
    if (!session || !isInActiveBranch(authEntity, session)) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND);
    if (!dto.orderId && session.endedAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.SESSION_ALREADY_ENDED);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const discount = dto.discount ?? 0;
    if (discount > 0 && !can(authEntity.role, "payments:discount")) {
      throw new ForbiddenException(PAYMENT_ERROR_MESSAGES.DISCOUNT_NOT_ALLOWED);
    }

    return this.paymentRepository.$transaction(async tx => {
      // §16b — scopes this charge to one floor order's own bill rather than the whole session's
      // tab. Never a table order: a table settles as a merged tab, independent of any one order.
      const order = dto.orderId ? await this.orderRepository.findById(dto.orderId, { tx }) : null;
      if (dto.orderId) {
        if (!order || order.sessionId !== session.id) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
        if (!order.floorId) throw new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FLOOR);
        if (order.paidAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID);
      }

      const dishes = await this.dishRepository.findManyByIds(
        dto.items.map(line => line.dishId),
        { tx }
      );

      // A line is a dish plus the variant and add-ons that were ordered with it. Looked up by id even if
      // archived since: the diner already has the food, and a dish going off the menu mid-meal must not
      // stop the bill being settled.
      const variantIds = [...new Set(dto.items.flatMap(line => (line.variantId ? [line.variantId] : [])))];
      const addOnIds = [...new Set(dto.items.flatMap(line => line.addOnIds ?? []))];
      const [variants, addOns] = await Promise.all([
        Promise.all(variantIds.map(id => this.dishVariantRepository.findById(id, { tx }))),
        addOnIds.length ? this.addOnRepository.findManyByIds(addOnIds, { tx }) : Promise.resolve([]),
      ]);

      const items: IPaymentItemCreate[] = dto.items.map(line => {
        const dish = dishes.find(candidate => candidate.id === line.dishId);
        if (!dish || dish.branchId !== session.branchId) {
          throw new NotFoundException({ ...PAYMENT_ERROR_MESSAGES.DISH_NOT_FOUND, detail: { dishId: line.dishId } });
        }

        // §36 — the variant must be this dish's own; a variant id is never taken to price a different dish.
        const variant = line.variantId ? variants.find(candidate => candidate?.id === line.variantId) : undefined;
        if (line.variantId && (!variant || variant.dishId !== dish.id)) {
          throw new NotFoundException({
            ...PAYMENT_ERROR_MESSAGES.VARIANT_NOT_FOUND,
            detail: { variantId: line.variantId, dishId: dish.id },
          });
        }

        const lineAddOns = (line.addOnIds ?? []).map(id => {
          const addOn = addOns.find(candidate => candidate.id === id);
          if (!addOn || addOn.branchId !== session.branchId) {
            throw new NotFoundException({ ...PAYMENT_ERROR_MESSAGES.ADD_ON_NOT_FOUND, detail: { addOnId: id, dishId: dish.id } });
          }
          return addOn;
        });

        // Same rule an order is priced by: the variant's own price replaces the dish's, add-ons stack on top.
        const unitPrice = (variant ? variant.price : dish.price) + lineAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
        const name = [
          dish.name,
          variant ? ` · ${variant.name}` : "",
          lineAddOns.length ? ` + ${lineAddOns.map(addOn => addOn.name).join(", ")}` : "",
        ].join("");
        return { dishId: dish.id, dishNameSnapshot: name, unitPrice, quantity: line.quantity };
      });

      const totals = calculateOrderTotals(items, restaurant, discount);
      if (totals.total < 0) throw new ConflictException(PAYMENT_ERROR_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);

      const payment = await this.paymentRepository.create(
        {
          restaurantId: authEntity.restaurantId,
          branchId: session.branchId,
          sessionId: session.id,
          tableId: session.tableId,
          floorId: session.floorId,
          customerId: await this.resolveCustomerId(session, order, authEntity.restaurantId),
          subtotal: totals.subtotal,
          serviceCharge: totals.serviceCharge,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          method: dto.method,
          currency: restaurant.currency,
          createdBy: authEntity.sub,
          createdByName: authEntity.name,
          items,
        },
        { tx }
      );

      await this.auditLogService.record(
        {
          action: AuditAction.payment_completed,
          subject: order ? `Order ${order.reference}` : `Session ${session.id}`,
          detail: `Charged ${payment.total} ${payment.currency} via ${payment.method}${discount > 0 ? ` (${discount} discount)` : ""}`,
        },
        authEntity,
        tx
      );

      if (order) {
        // Marks exactly this order paid and re-derives its own status — never the session-wide
        // `endSession` below, which a floor order's "no shared bill" rule (§16b) must not trigger.
        const paidAt = new Date();
        const status = deriveOrderStatus(order.items, order.cancelledAt, order.orderType, { isFloorOrder: true, paidAt });
        const updatedOrder = await this.orderRepository.update(
          order.id,
          { paidAt, status: status ?? order.status, completedAt: status === OrderStatus.COMPLETED ? paidAt : order.completedAt },
          { tx, actorId: authEntity.sub }
        );
        this.eventEmitter.emit("order.updated", updatedOrder);
      } else if (dto.endSession) {
        await this.diningSessionService.endSession(session, authEntity, tx);
      }

      return payment;
    });
  }

  /**
   * Who is paying. A floor payment settles one order, so that order's customer; a delivery session
   * has its own; a table payment settles the whole visit, so it takes the customer the table
   * session's orders were placed under (every order in a table session shares one — first wins).
   */
  private async resolveCustomerId(
    session: { id: string; branchId: string; customerId: string | null },
    order: { customerId: string | null } | null,
    restaurantId: string
  ): Promise<string | null> {
    if (order) return order.customerId;
    if (session.customerId) return session.customerId;
    const orders = await this.orderRepository.findBySessionId(session.id, restaurantId, session.branchId);
    return orders.find(candidate => candidate.customerId)?.customerId ?? null;
  }
}
