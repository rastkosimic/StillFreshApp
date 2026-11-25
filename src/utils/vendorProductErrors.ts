import {
  isDuplicateProductError,
  isMissingProductError,
} from '@/services/vendorProductService';

/** Translation key for a failed product-list call. */
export function vendorProductErrorKey(error: unknown): string {
  if (isDuplicateProductError(error)) return 'vendor.products.errorDuplicate';
  if (isMissingProductError(error)) return 'vendor.products.errorNotFound';
  return 'vendor.products.errorGeneric';
}
