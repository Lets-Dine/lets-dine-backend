export interface IMenuCategory {
  id: string;
  restaurantId: string;
  /** The branch whose menu this section belongs to. */
  branchId: string;
  name: string;
  emoji: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
