import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { can } from "../../../../common/auth";
import { ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DiningSessionService } from "../../../dining-sessions/application/dining-session.service";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { calculateOrderTotals } from "../../../orders/domain/utils/money.util";
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
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CompletePaymentInput, authEntity: AuthEntity): Promise<IPaymentWithItems> {
    const [session, restaurant] = await Promise.all([
      this.diningSessionRepository.findById(dto.sessionId),
      this.restaurantRepository.findById(authEntity.restaurantId),
    ]);
    if (!session || session.restaurantId !== authEntity.restaurantId) throw new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND);
    if (session.endedAt) throw new ConflictException(PAYMENT_ERROR_MESSAGES.SESSION_ALREADY_ENDED);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const discount = dto.discount ?? 0;
    if (discount > 0 && !can(authEntity.role, "payments:discount")) {
      throw new ForbiddenException(PAYMENT_ERROR_MESSAGES.DISCOUNT_NOT_ALLOWED);
    }

    return this.paymentRepository.$transaction(async tx => {
      const dishes = await this.dishRepository.findManyByIds(
        dto.items.map(line => line.dishId),
        { tx }
      );

      const items: IPaymentItemCreate[] = dto.items.map(line => {
        const dish = dishes.find(candidate => candidate.id === line.dishId);
        if (!dish || dish.restaurantId !== authEntity.restaurantId) {
          throw new NotFoundException({ ...PAYMENT_ERROR_MESSAGES.DISH_NOT_FOUND, detail: { dishId: line.dishId } });
        }
        return { dishId: dish.id, dishNameSnapshot: dish.name, unitPrice: dish.price, quantity: line.quantity };
      });

      const totals = calculateOrderTotals(items, restaurant, discount);
      if (totals.total < 0) throw new ConflictException(PAYMENT_ERROR_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);

      const payment = await this.paymentRepository.create(
        {
          restaurantId: authEntity.restaurantId,
          sessionId: session.id,
          tableId: session.tableId,
          ...totals,
          method: dto.method,
          currency: restaurant.currency,
          createdBy: authEntity.sub,
          items,
        },
        { tx }
      );

      await this.auditLogService.record(
        {
          action: AuditAction.payment_completed,
          subject: `Session ${session.id}`,
          detail: `Charged ${payment.total} ${payment.currency} via ${payment.method}${discount > 0 ? ` (${discount} discount)` : ""}`,
        },
        authEntity,
        tx
      );

      if (dto.endSession) {
        await this.diningSessionService.endSession(session, authEntity, tx);
      }

      return payment;
    });
  }
}
