import { create } from 'zustand';

interface OffersRefreshState {
  /** Bumped whenever offer list data should be refreshed. */
  revision: number;
  /** Optimistic quantity deductions until the next successful refetch. */
  reservations: Record<string, number>;
}

interface OffersRefreshActions {
  recordReservation: (offerId: number | string, quantity: number) => void;
  clearReservations: () => void;
}

export const useOffersRefreshStore = create<OffersRefreshState & OffersRefreshActions>(
  (set) => ({
    revision: 0,
    reservations: {},

    recordReservation: (offerId, quantity) =>
      set((state) => ({
        revision: state.revision + 1,
        reservations: {
          ...state.reservations,
          [String(offerId)]: (state.reservations[String(offerId)] ?? 0) + quantity,
        },
      })),

    clearReservations: () => set({ reservations: {} }),
  }),
);
