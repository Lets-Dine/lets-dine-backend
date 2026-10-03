/**
 * A repeat diner, identified globally by phone — §22/§16b, one deliberate
 * step past the app's fully-anonymous model. The same person can be a
 * repeat customer at any number of restaurants (`CustomerRestaurant` is the
 * pivot that tracks which ones); this is always that global identity
 * resolved *in the context of one restaurant* — `id` is the diner's one
 * `Customer` row shared across every restaurant they've ordered from,
 * `restaurantId` is whichever restaurant asked, and `defaultAddress`/
 * `defaultNote` are that restaurant's own remembered defaults for them, not
 * a global default. Upserted either when a delivery session starts or when
 * a floor order is placed.
 */
export interface ICustomer {
  id: string;
  restaurantId: string;
  phone: string;
  name: string;
  defaultAddress: string | null;
  defaultNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerSegment = "new" | "regular" | "lapsed" | "occasional";

/**
 * One row of the dashboard's customers list, scoped to a branch: who they are plus the
 * handful of figures the list shows. Everything but identity is derived from their payments; a customer who hasn't paid yet has zeros.
 */
export interface ICustomerListItem {
  id: string;
  name: string;
  phone: string;
  segment: CustomerSegment;
  /** Distinct dining sessions this customer paid for at the branch. */
  visits: number;
  /** Their latest payment; null if they haven't paid yet. */
  lastVisitAt: Date | null;
  /** Sum of the payments taken from this customer at the branch, in minor units. */
  spend: number;
  /** When this restaurant first knew them. */
  joinedAt: Date;
  /** Whether they paid in each of the last `RHYTHM_WEEKS` weeks, oldest first. */
  visitWeeks: boolean[];
}
