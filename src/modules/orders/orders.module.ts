import { forwardRef, Module } from "@nestjs/common";
import { AddOnsModule } from "../add-ons/add-ons.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BranchesModule } from "../branches/branches.module";
import { CustomersModule } from "../customers/customers.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { DishesModule } from "../dishes/dishes.module";
import { DishVariantsModule } from "../dish-variants/dish-variants.module";
import { InventoryModule } from "../inventory/inventory.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { TablesModule } from "../tables/tables.module";
import { AddOrderItemUsecase } from "./application/use-cases/add-order-item.usecase";
import { AdvanceOrderItemStatusUsecase } from "./application/use-cases/advance-order-item-status.usecase";
import { CancelOrderItemUsecase } from "./application/use-cases/cancel-order-item.usecase";
import { CancelOrderUsecase } from "./application/use-cases/cancel-order.usecase";
import { CreateOrderUsecase } from "./application/use-cases/create-order.usecase";
import { FetchAllOrdersUsecase } from "./application/use-cases/fetch-all-orders.usecase";
import { FetchOrderByIdUsecase } from "./application/use-cases/fetch-order-by-id.usecase";
import { FetchOrdersBySessionUsecase } from "./application/use-cases/fetch-orders-by-session.usecase";
import { FetchSessionOrderUsecase } from "./application/use-cases/fetch-session-order.usecase";
import { FetchSessionOrdersUsecase } from "./application/use-cases/fetch-session-orders.usecase";
import { RemoveOrderItemUsecase } from "./application/use-cases/remove-order-item.usecase";
import { SettleDeliveryOrderUsecase } from "./application/use-cases/settle-delivery-order.usecase";
import { SettleTableUsecase } from "./application/use-cases/settle-table.usecase";
import { UpdateOrderStatusUsecase } from "./application/use-cases/update-order-status.usecase";
import { OrderRepository } from "./domain/repositories/order.repository";
import OrderRepositoryImpl from "./infrastructure/repositories/order.repository.impl";
import { OrderController } from "./interfaces/http/order.controller";
import { RestaurantOrderController } from "./interfaces/http/restaurant-order.controller";
import { OrdersGateway } from "./interfaces/ws/orders.gateway";
import { BillingModule } from "../billing/billing.module";

@Module({
  // `DiningSessionsModule` now also depends on this module (`EndDiningSessionService`
  // needs `OrderRepository`) — a genuine cycle, broken with `forwardRef` on both sides.
  imports: [
    BillingModule,
    forwardRef(() => DiningSessionsModule),
    BranchesModule,
    RestaurantsModule,
    DishesModule,
    TablesModule,
    AuditLogsModule,
    AddOnsModule,
    DishVariantsModule,
    CustomersModule,
    InventoryModule,
  ],
  controllers: [OrderController, RestaurantOrderController],
  providers: [
    CreateOrderUsecase,
    FetchSessionOrderUsecase,
    FetchSessionOrdersUsecase,
    FetchAllOrdersUsecase,
    FetchOrderByIdUsecase,
    FetchOrdersBySessionUsecase,
    UpdateOrderStatusUsecase,
    CancelOrderUsecase,
    AddOrderItemUsecase,
    RemoveOrderItemUsecase,
    AdvanceOrderItemStatusUsecase,
    CancelOrderItemUsecase,
    SettleTableUsecase,
    SettleDeliveryOrderUsecase,
    OrderRepositoryImpl,
    { provide: OrderRepository, useExisting: OrderRepositoryImpl },
    OrdersGateway,
  ],
  exports: [{ provide: OrderRepository, useExisting: OrderRepositoryImpl }],
})
export class OrdersModule {}
