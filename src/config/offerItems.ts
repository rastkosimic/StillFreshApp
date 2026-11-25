/**
 * Limits for the optional contents list of an offer and for a location's product list.
 * They mirror the backend (vendor-service OfferItemRules / VendorProductService); the server
 * enforces them, these only keep the form from offering something it would reject.
 */
export const OFFER_ITEM_LIMITS = {
  maxItems: 20,
  maxNameLength: 60,
  maxQuantity: 99,
} as const;

export const MAX_VENDOR_PRODUCTS = 200;
