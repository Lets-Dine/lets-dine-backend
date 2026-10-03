export interface IAddOn {
  id: string;
  restaurantId: string;
  /** The branch whose menu offers this add-on. */
  branchId: string;
  name: string;
  /** Integer minor units (paisa) — never a float. */
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
