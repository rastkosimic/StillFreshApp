import { Offer } from '@/types';

/** Apply pending local reservations on top of server offer quantities. */
export function applyOfferReservations(
  offers: Offer[],
  reservations: Record<string, number>,
): Offer[] {
  if (Object.keys(reservations).length === 0) {
    return offers;
  }

  return offers.map((offer) => {
    const reserved = reservations[String(offer.id)] ?? 0;
    if (reserved <= 0) {
      return offer;
    }

    const quantityAvailable = Math.max(0, offer.quantityAvailable - reserved);
    const soldOut = quantityAvailable === 0;

    return {
      ...offer,
      quantityAvailable,
      soldOut: soldOut || offer.soldOut,
      greyedOut: soldOut || offer.greyedOut,
    };
  });
}
