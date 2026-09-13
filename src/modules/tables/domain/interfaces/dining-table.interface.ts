export interface IDiningTable {
  id: string;
  restaurantId: string;
  name: string;
  /** Opaque and printed on the table — §53, never derived from the table name. */
  qrToken: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
