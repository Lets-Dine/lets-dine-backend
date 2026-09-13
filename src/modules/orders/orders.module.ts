import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { DishesModule } from "../dishes/dishes.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { CancelOrderUsecase } from "./application/use-cases/cancel-order.usecase";
import { CreateOrderUsecase } from "./application/use-cases/create-order.usecase";
import { FetchAllOrdersUsecase } from "./application/use-cases/fetch-all-orders.usecase";
import { FetchOrderByIdUsecase } from "./application/use-cases/fetch-order-by-id.usecase";
import { FetchSessionOrderUsecase } from "./application/use-cases/fetch-session-order.usecase";
import { FetchSessionOrdersUsecase } from "./application/use-cases/fetch-session-orders.usecase";
import { UpdateOrderStatusUsecase } from "./application/use-cases/update-order-status.usecase";
import { OrderRepository } from "./domain/repositories/order.repository";
import OrderRepositoryImpl from "./infrastructure/repositories/order.repository.impl";
import { OrderController } from "./interfaces/http/order.controller";
import { RestaurantOrderController } from "./interfaces/http/restaurant-order.controller";

@Module({
  imports: [DiningSessionsModule, RestaurantsModule, DishesModule, AuditLogsModule],
  controllers: [OrderController, RestaurantOrderController],
  providers: [
    CreateOrderUsecase,
    FetchSessionOrderUsecase,
    FetchSessionOrdersUsecase,
    FetchAllOrdersUsecase,
    FetchOrderByIdUsecase,
    UpdateOrderStatusUsecase,
    CancelOrderUsecase,
    OrderRepositoryImpl,
    { provide: OrderRepository, useExisting: OrderRepositoryImpl },
  ],
  exports: [{ provide: OrderRepository, useExisting: OrderRepositoryImpl }],
})
export class OrdersModule {}
