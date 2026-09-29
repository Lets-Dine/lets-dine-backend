export interface IAddOn {
  id: string;
  restaurantId: string;
  name: string;
  /** Integer minor units (paisa) — never a float. */
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
