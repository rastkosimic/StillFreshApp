export type OfferStatus = 'ACTIVE' | 'EXPIRED' | 'SOLD_OUT' | 'INACTIVE';

// Matches the actual backend OfferDto response shape.
// NOTE: price and originalPrice are floats in currency units (e.g. 4.99 EUR), NOT cents.
// Use Math.round(price * 100) when passing to formatCurrency().
export interface Offer {
  id: number;
  vendorId: number;
  // Vendor display fields (vendorName was removed — use these instead)
  locationName?: string;   // branch label, e.g. "Downtown"; business name for independents
  chainName?: string;      // brand label, e.g. "Starbucks"; null for independent vendors
  website?: string;
  vendorImageUrl?: string; // vendor logo/profile image
  name: string;
  description?: string;
  price: number;           // float in currency units, e.g. 4.99
  originalPrice?: number;  // float in currency units
  currency: string;        // e.g. "EUR", "RSD"
  quantityAvailable: number;
  originalQuantity?: number;
  imageUrl?: string;
  rating?: number;
  reviewsCount?: number;
  address: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;       // metres from user, provided by search-nearby
  businessType?: string;
  category?: OfferCategory;
  dietaryInfo?: string;
  allergenInfo?: string;
  expirationDate?: string;
  active?: boolean;
  // Provided by backend — never compute client-side
  pickupDate?: string;        // YYYY-MM-DD
  pickupStartTime?: string;   // HH:MM:SS
  pickupEndTime?: string;     // HH:MM:SS
  pickupDaySlot?: string;     // 'TODAY' | 'TOMORROW'
  pickupMealSlot?: string;    // 'LUNCH' | 'DINNER'
  collectNow?: boolean;
  expired?: boolean;
  soldOut?: boolean;
  greyedOut?: boolean;
}

export type OfferCategory =
  | 'MEALS'
  | 'BREAD_PASTRIES'
  | 'GROCERIES'
  | 'FLOWERS_PLANTS'
  | 'PET_FOOD';

export interface Category {
  value: OfferCategory;
  displayName: string;
}
