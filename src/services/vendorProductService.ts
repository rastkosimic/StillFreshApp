import apiClient from './apiClient';
import { ApiError, VendorProduct } from '@/types';

/**
 * A location's own product list, used to pick the optional contents of an offer.
 * The backend scopes every call to the caller's location (workers use the list of the
 * location they are assigned to), so no location id is sent.
 */

export async function getVendorProducts(): Promise<VendorProduct[]> {
  const response = await apiClient.get<VendorProduct[]>('/vendors/products');
  return response.data;
}

export async function createVendorProduct(name: string): Promise<VendorProduct> {
  const response = await apiClient.post<VendorProduct>('/vendors/products', { name });
  return response.data;
}

export async function renameVendorProduct(
  productId: number,
  name: string,
): Promise<VendorProduct> {
  const response = await apiClient.put<VendorProduct>(`/vendors/products/${productId}`, {
    name,
  });
  return response.data;
}

/** Offers that already list the product keep the name they were saved with. */
export async function deleteVendorProduct(productId: number): Promise<void> {
  await apiClient.delete(`/vendors/products/${productId}`);
}

/** 409: the location already has a product with that name (compared ignoring case). */
export function isDuplicateProductError(error: unknown): boolean {
  return (error as ApiError | undefined)?.status === 409;
}

/** 404: the product was already deleted, e.g. by a colleague at the same location. */
export function isMissingProductError(error: unknown): boolean {
  return (error as ApiError | undefined)?.status === 404;
}
