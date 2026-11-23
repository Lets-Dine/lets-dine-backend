/** A diner (QR table, delivery or pickup) placed an order. Staff ringing one up at the till do not raise it: they already know. */
export const ORDER_PLACED_BY_DINER = "order.placed.by.diner";
/** A line of an order was marked ready, after the transaction that did it committed. */
export const ORDER_ITEM_READY = "order.item.ready";
/** A diner asked for a waiter or the bill. Clearing a request does not raise it. */
export const SERVICE_RAISED = "service.raised";
