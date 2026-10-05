export interface IRestaurant {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  currency: string;
  timezone: string;
  /** Ratios (0..1) the order total is built from — §41, never hardcoded. */
  serviceChargeRate: number;
  taxRate: number;
  /** Flat minor-unit delivery charge; null/0 = no fee. */
  deliveryFeeAmount: number | null;
  /** VAT/PAN registration number printed on receipts. */
  vatPanNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
