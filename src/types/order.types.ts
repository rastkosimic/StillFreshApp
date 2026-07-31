import { Offer } from './offer.types';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

/** Active basket statuses shown on the Orders (Basket) tab. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'READY'];

export interface Order {
  /** Canonical ID from backend (`id` field). */
  id: number | string;
  /** Alias for `id` — set by normalizeOrder for backward compatibility. */
  orderId: number | string;
  offerId: number | string;
  vendorId?: number | string;
  userId?: number | string;
  status: OrderStatus;
  quantity: number;
  /** Major currency units from order API (e.g. 730.0 RSD). Use formatOrderAmount(). */
  unitPrice?: number;
  totalPrice: number;
  currency?: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  pickupBy?: string; // ISO 8601 deadline
  pickupStartTime?: string; // HH:MM:SS
  pickupEndTime?: string;   // HH:MM:SS
  pickupDate?: string;      // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
  offer?: Offer;
  cancellationReason?: string;
  latitude?: number;
  longitude?: number;
  // Vendor snapshot — captured at order-creation time
  locationName?: string;
  chainName?: string;
  website?: string;
  vendorImageUrl?: string;
  // Offer snapshot
  offerName?: string;
  offerImageUrl?: string;
  address?: string;
  zipCode?: string;
  // Settlement snapshot — present on COMPLETED orders after capture
  grossAmountCents?: number;
  platformFeeCents?: number;
  netAmountCents?: number;
  feePercentApplied?: number;
  settledAt?: string;
}

export interface PlaceOrderResponse {
  message: string;
  requestId: string;
}

export interface CancelOrderRequest {
  reason?: string;
  userLat?: number;
  userLon?: number;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}
