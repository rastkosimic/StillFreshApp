import { create } from 'zustand';

import { getActiveBasketCount } from '@/services/orderService';

interface BasketState {
  activeCount: number;
}

interface BasketActions {
  fetchActiveCount: () => Promise<void>;
  setActiveCount: (count: number) => void;
  resetBasketCount: () => void;
}

let fetchPromise: Promise<void> | null = null;

export const useBasketStore = create<BasketState & BasketActions>((set) => ({
  activeCount: 0,

  fetchActiveCount: async () => {
    if (fetchPromise) {
      return fetchPromise;
    }

    fetchPromise = (async () => {
      try {
        const count = await getActiveBasketCount();
        set({ activeCount: count });
      } catch {
        // Keep the last known count on error.
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  },

  setActiveCount: (count) => set({ activeCount: count }),

  resetBasketCount: () => set({ activeCount: 0 }),
}));
