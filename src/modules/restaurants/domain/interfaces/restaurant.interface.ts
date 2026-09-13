export interface IRestaurant {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverImageUrl: string | null;
  currency: string;
  timezone: string;
  /** Ratios (0..1) the order total is built from — §41, never hardcoded. */
  serviceChargeRate: number;
  taxRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
