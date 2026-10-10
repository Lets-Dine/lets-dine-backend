export interface IBranchHours {
  id: string;
  branchId: string;
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** `HH:mm` in the branch's own timezone. */
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface IBranch {
  id: string;
  restaurantId: string;
  name: string;
  slug: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  /** Null = inherit from the restaurant. */
  serviceChargeRate: number | null;
  taxRate: number | null;
  deliveryFeeAmount: number | null;
  /** Null = inherit from the restaurant. */
  autoConsumeStock: boolean | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranchWithHours extends IBranch {
  hours: IBranchHours[];
}
