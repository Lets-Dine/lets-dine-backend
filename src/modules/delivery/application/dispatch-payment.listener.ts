import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AuthEntity } from "../../../common/interfaces";
import { DeliveryRepository } from "../domain/repositories/delivery.repository";
import { DeliveryPaymentService, ORDER_DISPATCHED } from "./delivery-payment.service";

/**
 * Opens the bill of a cash-on-delivery order once it has gone out. It runs after the status change has committed,
 * so a failure here cannot undo the dispatch; settlement opens the bill itself if it is still missing.
 */
@Injectable()
export class DispatchPaymentListener {
  private readonly logger = new Logger(DispatchPaymentListener.name);

  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly deliveryPayment: DeliveryPaymentService
  ) {}

  @OnEvent(ORDER_DISPATCHED)
  async onDispatched({ orderId, actor }: { orderId: string; actor: AuthEntity }): Promise<void> {
    try {
      await this.deliveryRepository.$transaction(tx => this.deliveryPayment.openForDispatch(orderId, actor, tx));
    } catch (error) {
      this.logger.error(`Could not open the delivery bill for order ${orderId}`, error instanceof Error ? error.stack : String(error));
    }
  }
}
