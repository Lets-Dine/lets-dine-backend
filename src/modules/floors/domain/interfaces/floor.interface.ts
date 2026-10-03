export interface IFloor {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  /** Opaque and printed on the floor's shared QR — never derived from the floor name. */
  qrToken: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
