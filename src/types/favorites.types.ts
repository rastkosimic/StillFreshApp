import { Offer } from './offer.types';

export interface FavoritesResponse {
  favorites: Offer[];
  expiredCount: number;
  soldOutCount: number;
}
