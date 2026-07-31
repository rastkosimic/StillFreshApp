import { useState, useCallback } from 'react';
import { searchNearby, SearchNearbyParams } from '@/services/offerService';
import { Offer } from '@/types';

interface UseOffersResult {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  refresh: (params: SearchNearbyParams) => Promise<void>;
}

export function useOffers(): UseOffersResult {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params: SearchNearbyParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchNearby(params);
      setOffers(result.offers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { offers, isLoading, error, refresh };
}
