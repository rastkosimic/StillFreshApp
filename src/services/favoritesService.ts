import apiClient from './apiClient';
import { FavoritesResponse, Offer } from '@/types';
import { normalizeImageUrl } from '@/utils/normalizeImageUrl';

/**
 * Normalizes a raw favorites API entry into an Offer.
 *
 * The backend returns favorite records, not bare Offer objects:
 *   { id, offerId, offer: { id, name, price, ... } }
 * This function extracts the nested offer (falling back to the raw entry
 * if the response is already flat) and normalises alternative field names.
 */
function normalizeFavoriteEntry(raw: Record<string, unknown>): Offer {
  // Prefer the nested offer; fall back to the raw entry for flat responses
  const offer = (raw.offer as Record<string, unknown>) ?? raw;

  // Some endpoints use 'quantity' or 'availableQuantity' instead of 'quantityAvailable'
  const quantityAvailable =
    (offer.quantityAvailable as number | undefined) ??
    (offer.availableQuantity as number | undefined) ??
    (offer.quantity as number | undefined) ??
    0;

  return {
    ...(offer as unknown as Offer),
    quantityAvailable,
    imageUrl: normalizeImageUrl(offer.imageUrl as string | undefined),
    vendorImageUrl: normalizeImageUrl(offer.vendorImageUrl as string | undefined),
  };
}

export async function getFavorites(page = 0, limit = 100): Promise<FavoritesResponse> {
  const response = await apiClient.get<{ favorites: Record<string, unknown>[]; expiredCount?: number; soldOutCount?: number }>(
    '/users/favorites',
    { params: { page, limit } },
  );
  const data = response.data;
  return {
    favorites: (data.favorites ?? []).map(normalizeFavoriteEntry),
    expiredCount: data.expiredCount ?? 0,
    soldOutCount: data.soldOutCount ?? 0,
  };
}

export async function addFavorite(offerId: number | string): Promise<void> {
  await apiClient.post(`/users/favorites/${offerId}`);
}

export async function removeFavorite(offerId: number | string): Promise<void> {
  await apiClient.delete(`/users/favorites/${offerId}`);
}
