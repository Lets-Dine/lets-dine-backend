export abstract class UsageRepository {
  abstract countActiveBranches(restaurantId: string): Promise<number>;
  abstract countActiveSeats(restaurantId: string): Promise<number>;
  abstract getOrderCount(restaurantId: string, periodStart: Date): Promise<number>;
  /** Atomically adds one order to the period's counter and returns the new total. */
  abstract incrementOrderCount(restaurantId: string, periodStart: Date): Promise<number>;
}
