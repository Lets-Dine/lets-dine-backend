import { DeliveryChannel } from "@prisma/client";

export interface IRestaurant {
  id: string;
  name: string;
  /** Registered business name printed on receipts. */
  legalName: string;
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
  /** Off = no delivery orders; the menu stays visible. */
  deliveryEnabled: boolean;
  /** APP = orders placed in the app; WHATSAPP = the diner messages `whatsappNumber` instead. */
  deliveryChannel: DeliveryChannel;
  whatsappNumber: string | null;
  /** Whether starting a dish takes its recipe off stock; a branch or dish may override it. */
  autoConsumeStock: boolean;
  /** VAT/PAN registration number printed on receipts. */
  vatPanNumber: string | null;
  /** Pinned restaurant location — the start of every delivery route. Coordinates are both set or both null. */
  addressName: string | null;
  latitude: number | null;
  longitude: number | null;
  googleUrl: string | null;
  /** Null = set up by us, not yet claimed by its owner. */
  claimedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
