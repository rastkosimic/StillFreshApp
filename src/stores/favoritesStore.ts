import { create } from 'zustand';
import { Offer } from '@/types';
import { getFavorites, addFavorite, removeFavorite } from '@/services/favoritesService';

interface FavoritesState {
  favoriteIds: Set<number>;
  favorites: Offer[];
  expiredCount: number;
  soldOutCount: number;
  isLoading: boolean;
  initialized: boolean;
}

interface FavoritesActions {
  loadFavorites: (force?: boolean) => Promise<void>;
  toggleFavorite: (offer: Offer) => Promise<void>;
  reset: () => void;
}

const initialState: FavoritesState = {
  favoriteIds: new Set<number>(),
  favorites: [],
  expiredCount: 0,
  soldOutCount: 0,
  isLoading: false,
  initialized: false,
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>((set, get) => ({
  ...initialState,

  loadFavorites: async (force = false) => {
    const { initialized, isLoading } = get();
    if ((initialized && !force) || isLoading) return;
    set({ isLoading: true });
    try {
      const data = await getFavorites();
      set({
        favorites: data.favorites,
        favoriteIds: new Set(data.favorites.map(o => o.id)),
        expiredCount: data.expiredCount,
        soldOutCount: data.soldOutCount,
        initialized: true,
      });
    } catch {
      // Leave existing state intact on error
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (offer: Offer) => {
    const { favoriteIds, favorites } = get();
    const wasFavorite = favoriteIds.has(offer.id);

    // Optimistic update
    const nextIds = new Set(favoriteIds);
    if (wasFavorite) {
      nextIds.delete(offer.id);
      set({ favoriteIds: nextIds, favorites: favorites.filter(o => o.id !== offer.id) });
    } else {
      nextIds.add(offer.id);
      set({ favoriteIds: nextIds, favorites: [offer, ...favorites] });
    }

    // API call — rollback both pieces of state on failure
    try {
      if (wasFavorite) await removeFavorite(offer.id);
      else await addFavorite(offer.id);
    } catch {
      set({ favoriteIds, favorites });
    }
  },

  reset: () => set({ ...initialState, favoriteIds: new Set<number>() }),
}));
