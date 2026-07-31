import { Category, OfferCategory } from '@/types';

export const OFFER_CATEGORIES: OfferCategory[] = [
  'MEALS',
  'BREAD_PASTRIES',
  'GROCERIES',
  'FLOWERS_PLANTS',
  'PET_FOOD',
];

/**
 * Build the category list with localized display names.
 * Pass the `t` function from useTranslation().
 */
export function buildCategories(t: (key: string) => string): Category[] {
  return OFFER_CATEGORIES.map(value => ({
    value,
    displayName: t(`categories.${value}`),
  }));
}
