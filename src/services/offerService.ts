import apiClient from './apiClient';
import { Offer } from '@/types';
import { normalizeImageUrl } from '@/utils/normalizeImageUrl';

export interface SearchNearbyParams {
  latitude: number;
  longitude: number;
  range?: number;
  sort?: 'distance' | 'price_asc' | 'price_desc' | 'rating_desc';
  category?: string; // OfferCategory value, e.g. 'MEALS'; omit for all
}

export async function getOffers(): Promise<Offer[]> {
  const response = await apiClient.get<Offer[]>('/offers');
  return response.data;
}

export async function getOfferById(offerId: number | string): Promise<Offer> {
  const response = await apiClient.get<Offer>(`/offers/${offerId}`);
  return response.data;
}

export async function searchNearby(params: SearchNearbyParams): Promise<{ offers: Offer[] }> {
  const response = await apiClient.get('/offers/nearby', { params });
  const data = response.data;
  const raw: Offer[] = Array.isArray(data) ? data : (data.offers ?? []);
  const offers = raw.map((o) => ({
    ...o,
    imageUrl: normalizeImageUrl(o.imageUrl),
    vendorImageUrl: normalizeImageUrl(o.vendorImageUrl),
  }));
  return { offers };
}

export async function getActiveOffers(): Promise<Offer[]> {
  const response = await apiClient.get<Offer[]>('/offers/active');
  return response.data;
}
