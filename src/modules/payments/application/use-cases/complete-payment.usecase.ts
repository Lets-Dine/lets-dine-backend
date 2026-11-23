import { Injectable } from "@nestjs/common";
import { AuditAction, OrderItemStatus, OrderStatus, OrderType, PaymentMethod } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { can } from "../../../../common/auth";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { CustomerRepository } from "../../../customers/domain/repositories/customer.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LoyaltyService } from "../../../loyalty/application/loyalty.service";
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
import { billDiffersFromOrder } from "../../domain/utils/bill-lines.util";
import { openingTenders } from "../../domain/utils/tender.util";
import { PaymentApprovalService } from "../payment-approval.service";
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
    private readonly eventEmitter: EventEmitter2,
    private readonly loyaltyService: LoyaltyService,
    private readonly customerRepository: CustomerRepository,
    private readonly approvalService: PaymentApprovalService
  ) {}

  async execute(dto: CompletePaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    // A retried request returns the bill it already made — checked first, since the session may have ended with it.
    if (dto.idempotencyKey) {
      const replay = await this.paymentRepository.findByIdempotencyKey(authEntity.restaurantId, dto.idempotencyKey);
      if (replay && replay.branchId === authEntity.branchId) return replay;
    }
    const [session, restaurant] = await Promise.all([
      this.diningSessionRepository.findById(dto.sessionId),
      this.restaurantRepository.findByIdForBranch(authEntity.restaurantId, authEntity.branchId),
    ]);
    if (!session || !isInActiveBranch(authEntity, session)) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND);
    if (!dto.orderId && session.endedAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.SESSION_ALREADY_ENDED);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const discount = dto.discount ?? 0;
    // A discount, or a bill that is not what was ordered, is a manager's call. Somebody without that right can still get it
    // through with a manager's PIN, checked here and not inside the transaction so that a refused attempt is recorded and
    // counted even though the payment is refused.
    const mayOverride = can(authEntity.role, "payments:discount");
    // Only asked of the manager when something here needs it, so a PIN is never tested for a payment that needed none.
    const approver =
      !mayOverride && dto.approval && (await this.mightNeedApproval(dto, session, authEntity))
        ? await this.approvalService.verify(dto.approval, authEntity)
        : null;

    return this.paymentRepository.$transaction(async tx => {
      // §16b — scopes this charge to one floor order's own bill rather than the whole session's
      // tab. Never a table order: a table settles as a merged tab, independent of any one order.
      const order = dto.orderId ? await this.orderRepository.findById(dto.orderId, { tx }) : null;
      if (dto.orderId) {
        if (!order || order.sessionId !== session.id) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
        if (order.orderType === OrderType.DELIVERY) throw new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_IS_DELIVERY);
        if (order.tableId && !session.endedAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FLOOR);
        if (order.paidAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID);
      }

      // One table is billed one payment at a time, and never while an order edit on it is half-done.
      if (session.tableId) await tx.$queryRaw`SELECT id FROM dining_tables WHERE id = ${session.tableId}::uuid FOR UPDATE`;

      // A split-by-item bill never touches the menu: each line is an order line, priced by the order's own snapshot.
      const split = dto.split ? await this.splitLines(dto.split, session, authEntity, tx) : null;
      // Once part of a table was billed by item, billing "everything" would charge those lines twice.
      if (!split && !dto.orderId && (await this.paymentRepository.billedItems(session.id, { tx })).some(row => row.orderItemId)) {
        throw new ConflictException(PAYMENT_ERROR_MESSAGES.SPLIT_IN_PROGRESS);
      }
      const items = split ? split.items : await this.pricedItems(dto.items ?? [], session, tx);

      // A split bill never defaults to the table's customer — every split would then credit them the same visit's points.
      const resolvedCustomerId = split ? null : await this.resolveCustomerId(session, order, authEntity.restaurantId);
      // The cashier may name someone else (or nobody). Points follow this id, so it must be one of this restaurant's own customers.
      let customerId = resolvedCustomerId;
      let pickedName: string | null = null;
      if (dto.customerId !== undefined) {
        customerId = dto.customerId;
        if (customerId) {
          const picked = await this.customerRepository.findById(customerId, authEntity.restaurantId, { tx });
          if (!picked) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);
          pickedName = picked.name;
        }
      }

      // The invoice is made out to the customer on the bill unless the cashier names someone else (a company, say).
      // A customer has no PAN on file, so without one typed at the till this stays an abbreviated invoice.
      const defaultBuyerName =
        dto.buyerName || !customerId
          ? null
          : (pickedName ?? (await this.customerRepository.findById(customerId, authEntity.restaurantId, { tx }))?.name ?? null);

      if (!mayOverride) {
        const charged = dto.items ?? [];
        const ordered = split ? [] : await this.orderedLines(order, session, authEntity);
        const reasons: string[] = [];
        if (discount > 0) reasons.push("discount");
        if (!split && billDiffersFromOrder(charged, ordered)) reasons.push("lines");
        // Points and credit land on whoever the bill is for. Moving them to a customer the orders were not placed under would
        // spend somebody else's points, or leave a debt with somebody who was not there.
        if (dto.customerId !== undefined && customerId !== resolvedCustomerId && (dto.redeemPoints || dto.credit)) reasons.push("customer");
        if (reasons.length > 0) {
          const count = (lines: { quantity: number }[]) => lines.reduce((sum, line) => sum + line.quantity, 0);
          if (!approver) {
            throw new ForbiddenException({
              ...PAYMENT_ERROR_MESSAGES.APPROVAL_REQUIRED,
              // What the manager is being asked to approve, so they are not signing blind.
              detail: {
                reasons,
                sessionId: session.id,
                discount,
                currency: restaurant.currency,
                ordered: count(ordered),
                charged: count(charged),
              },
            });
          }
          await this.auditLogService.record(
            {
              action: AuditAction.payment_override_approved,
              subject: approver.name,
              detail: `Approved ${reasons.map(reason => (reason === "discount" ? `a ${discount} ${restaurant.currency} discount` : reason === "lines" ? "a bill changed from the order" : "points or credit on another customer")).join(", ")} on ${order ? `order ${order.reference}` : `session ${session.id}`}, taken by ${authEntity.name} (approver member ${approver.id})`,
            },
            authEntity,
            tx
          );
        }
      }

      // Points are a customer's entitlement, not the cashier's discretion, so they are kept apart from the
      // manual `discount` (and its permission) and the server turns them into money at the restaurant's rate.
      let loyaltyDiscount = 0;
      if (dto.redeemPoints) {
        const { subtotal } = calculateOrderTotals(items, restaurant, 0);
        loyaltyDiscount = await this.loyaltyService.planRedemption(
          { restaurantId: authEntity.restaurantId, customerId, points: dto.redeemPoints, discountableBase: subtotal - discount },
          tx
        );
      }

      const totals = calculateOrderTotals(items, restaurant, discount + loyaltyDiscount);
      if (totals.total < 0) throw new ConflictException(PAYMENT_ERROR_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);

      // The server decides what the bill is worth; the collections must fit inside it. A short bill is only
      // allowed as credit, and credit needs someone to owe it.
      const opening = openingTenders(totals.total, dto.method ?? PaymentMethod.CASH, dto.tenders ?? (dto.credit ? [] : undefined));
      if (opening.paidAmount > totals.total) throw new ConflictException(PAYMENT_ERROR_MESSAGES.TENDERS_EXCEED_TOTAL);
      if (opening.paidAmount < totals.total) {
        if (!dto.credit) throw new ConflictException(PAYMENT_ERROR_MESSAGES.TENDERS_BELOW_TOTAL);
        if (!customerId) throw new BadRequestException(PAYMENT_ERROR_MESSAGES.CREDIT_NEEDS_CUSTOMER);
      }

      const payment = await this.paymentRepository.create(
        {
          restaurantId: authEntity.restaurantId,
          branchId: session.branchId,
          sessionId: session.id,
          tableId: session.tableId,
          floorId: session.floorId,
          customerId,
          subtotal: totals.subtotal,
          serviceCharge: totals.serviceCharge,
          tax: totals.tax,
          discount: totals.discount,
          loyaltyDiscount,
          total: totals.total,
          ...opening,
          dueDate: dto.dueDate,
          idempotencyKey: dto.idempotencyKey,
          method: dto.method ?? opening.tenders[0]?.method ?? PaymentMethod.CASH,
          currency: restaurant.currency,
          createdBy: authEntity.sub,
          createdByName: authEntity.name,
          buyerName: dto.buyerName ?? defaultBuyerName,
          buyerPan: dto.buyerPan ?? null,
          items,
        },
        { tx }
      );

      await this.auditLogService.record(
        {
          action: AuditAction.payment_completed,
          subject: order ? `Order ${order.reference}` : `Session ${session.id}`,
          detail: `${split ? "Split by item: " : ""}Charged ${payment.total} ${payment.currency} via ${payment.method}${payment.paymentStatus === "PAID" ? "" : ` (${payment.paymentStatus}, ${payment.total - payment.paidAmount} owed)`}${discount > 0 ? ` (${discount} discount)` : ""}${dto.redeemPoints ? ` (${dto.redeemPoints} points redeemed, ${loyaltyDiscount} off)` : ""}${dto.customerId !== undefined && customerId !== resolvedCustomerId ? ` (customer changed to ${pickedName ?? "none"})` : ""}`,
        },
        authEntity,
        tx
      );

      if (dto.redeemPoints && customerId) {
        await this.loyaltyService.recordRedemption(
          {
            paymentId: payment.id,
            restaurantId: authEntity.restaurantId,
            customerId,
            points: dto.redeemPoints,
            createdBy: authEntity.sub,
            createdByName: authEntity.name,
          },
          tx
        );
      }
      // Points commit with the bill they were earned on; points spent come off the bill but not off what it earns.
      await this.loyaltyService.earnForPayment({ ...payment, loyaltyDiscount, orderId: order?.id ?? null }, tx);

      if (order) {
        // Marks exactly this order paid and re-derives its own status — never the session-wide
        // `endSession` below, which a floor order's "no shared bill" rule (§16b) must not trigger.
        const paidAt = new Date();
        // A pickup settles at the counter like a closed table: the food is handed over with the bill, so its unfinished lines are served here.
        let items = order.items;
        if (order.orderType === OrderType.PICKUP) {
          for (const item of order.items) {
            if (item.status === OrderItemStatus.CANCELLED || item.status === OrderItemStatus.SERVED) continue;
            items = (await this.orderRepository.updateItemStatus(item.id, OrderItemStatus.SERVED, { tx })).items;
          }
        }
        const status = deriveOrderStatus(items, order.cancelledAt, order.orderType, { paidAt });
        const updatedOrder = await this.orderRepository.update(
          order.id,
          { paidAt, status: status ?? order.status, completedAt: status === OrderStatus.COMPLETED ? paidAt : order.completedAt },
          { tx, actorId: authEntity.sub }
        );
        this.eventEmitter.emit("order.updated", updatedOrder);
      } else if (dto.endSession && (!split || split.left === 0)) {
        // A split bill ends the visit only with the last share; until then the table stays open for the rest.
        await this.diningSessionService.endSession(session, authEntity, tx, { paid: true });
      }

      return payment;
    });
  }

  /**
   * Whether this request could need a manager, judged before the transaction opens. Deliberately generous (it only decides whether
   * to test a PIN); the transaction decides for real once the table is locked.
   */
  private async mightNeedApproval(
    dto: CompletePaymentInput,
    session: { id: string; branchId: string },
    authEntity: AuthEntity
  ): Promise<boolean> {
    if ((dto.discount ?? 0) > 0) return true;
    if (dto.customerId !== undefined && (dto.redeemPoints || dto.credit)) return true;
    if (dto.split) return false;
    const order = dto.orderId ? await this.orderRepository.findById(dto.orderId) : null;
    return billDiffersFromOrder(dto.items ?? [], await this.orderedLines(order, session, authEntity));
  }

  /**
   * What the bill should be if nothing was changed: the lines of the one floor order being paid, or of every order on the
   * table's visit that has not been cancelled.
   */
  private async orderedLines(
    order: {
      items: { dishId: string; variantId: string | null; addOns: { addOnId: string }[]; quantity: number; status: OrderItemStatus }[];
    } | null,
    session: { id: string; branchId: string },
    authEntity: AuthEntity
  ) {
    const orders = order
      ? [order]
      : (await this.orderRepository.findBySessionId(session.id, authEntity.restaurantId, session.branchId)).filter(
          o => o.status !== OrderStatus.CANCELLED
        );
    return orders.flatMap(o =>
      o.items
        .filter(item => item.status !== OrderItemStatus.CANCELLED)
        .map(item => ({
          dishId: item.dishId,
          variantId: item.variantId,
          addOnIds: item.addOns.map(addOn => addOn.addOnId),
          quantity: item.quantity,
        }))
    );
  }

  /**
   * A split-by-item bill: manager-only, table sessions only. Locks the session so two cashiers cannot bill the same
   * line at once, then takes each chosen order line at the order's own price. `left` is what stays unbilled after this one.
   */
  private async splitLines(
    split: NonNullable<CompletePaymentInput["split"]>,
    session: { id: string; branchId: string; tableId: string | null },
    authEntity: AuthEntity,
    tx: PrismaTransaction
  ): Promise<{ items: IPaymentItemCreate[]; left: number }> {
    if (!can(authEntity.role, "payments:split")) throw new ForbiddenException(PAYMENT_ERROR_MESSAGES.SPLIT_NOT_ALLOWED);
    if (!session.tableId) throw new ConflictException(PAYMENT_ERROR_MESSAGES.SPLIT_TABLE_ONLY);
    const [orders, billedRows] = await Promise.all([
      this.orderRepository.findBySessionId(session.id, authEntity.restaurantId, session.branchId),
      this.paymentRepository.billedItems(session.id, { tx }),
    ]);
    // A whole-table bill with no order lines named can't be told apart from these lines, so billing by item on top of it would charge them twice.
    if (billedRows.some(row => !row.orderItemId)) throw new ConflictException(PAYMENT_ERROR_MESSAGES.SPLIT_AFTER_WHOLE_BILL);
    const billed = new Map(billedRows.map(row => [row.orderItemId, row.quantity]));
    const open = new Map<string, { item: (typeof orders)[number]["items"][number]; left: number }>();
    for (const order of orders) {
      if (order.status === OrderStatus.CANCELLED) continue;
      for (const item of order.items) {
        if (item.status !== OrderItemStatus.CANCELLED) open.set(item.id, { item, left: item.quantity - (billed.get(item.id) ?? 0) });
      }
    }

    const wanted = new Map<string, number>();
    for (const line of split) wanted.set(line.orderItemId, (wanted.get(line.orderItemId) ?? 0) + line.quantity);

    const items: IPaymentItemCreate[] = [];
    for (const [orderItemId, quantity] of wanted) {
      const entry = open.get(orderItemId);
      if (!entry) throw new NotFoundException({ ...PAYMENT_ERROR_MESSAGES.SPLIT_ITEM_NOT_FOUND, detail: { orderItemId } });
      if (quantity > entry.left) {
        throw new ConflictException({ ...PAYMENT_ERROR_MESSAGES.SPLIT_OVER_REMAINING, detail: { orderItemId, left: entry.left } });
      }
      const { item } = entry;
      const name = [
        item.dishNameSnapshot,
        item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : "",
        item.addOns.length ? ` + ${item.addOns.map(addOn => addOn.nameSnapshot).join(", ")}` : "",
      ].join("");
      items.push({ dishId: item.dishId, orderItemId, dishNameSnapshot: name, unitPrice: item.unitPrice, quantity });
    }

    const unbilled = [...open.values()].reduce((sum, entry) => sum + Math.max(entry.left, 0), 0);
    return { items, left: unbilled - items.reduce((sum, line) => sum + line.quantity, 0) };
  }

  /** Prices cashier-chosen lines fresh from the menu. */
  private async pricedItems(
    lines: NonNullable<CompletePaymentInput["items"]>,
    session: { branchId: string },
    tx: PrismaTransaction
  ): Promise<IPaymentItemCreate[]> {
    const dishes = await this.dishRepository.findManyByIds(
      lines.map(line => line.dishId),
      { tx }
    );

    // A line is a dish plus the variant and add-ons that were ordered with it. Looked up by id even if
    // archived since: the diner already has the food, and a dish going off the menu mid-meal must not
    // stop the bill being settled.
    const variantIds = [...new Set(lines.flatMap(line => (line.variantId ? [line.variantId] : [])))];
    const addOnIds = [...new Set(lines.flatMap(line => line.addOnIds ?? []))];
    const [variants, addOns] = await Promise.all([
      Promise.all(variantIds.map(id => this.dishVariantRepository.findById(id, { tx }))),
      addOnIds.length ? this.addOnRepository.findManyByIds(addOnIds, { tx }) : Promise.resolve([]),
    ]);

    return lines.map(line => {
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
