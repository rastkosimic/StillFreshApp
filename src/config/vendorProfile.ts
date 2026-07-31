// Frontend constants for vendor profile options.
// These mirror backend enums — no API call needed.

export type BusinessType =
  | 'RESTAURANT'
  | 'CAFE'
  | 'BAKERY'
  | 'PASTRY_SHOP'
  | 'GROCERY_STORE'
  | 'FOOD_TRUCK'
  | 'CATERING'
  | 'FARM'
  | 'BREWERY'
  | 'GAS_STATION'
  | 'OTHER';

export type SurplusFoodType =
  | 'FRESH_PRODUCE'
  | 'BAKED_GOODS'
  | 'CAKES'
  | 'COOKIES'
  | 'CONFECTIONERY'
  | 'DAIRY'
  | 'MEAT_SEAFOOD'
  | 'PREPARED_MEALS'
  | 'PANTRY_ITEMS'
  | 'FROZEN'
  | 'ALCOHOLIC_DRINKS'
  | 'NON_ALCOHOLIC_DRINKS'
  | 'SNACKS'
  | 'ORGANIC'
  | 'GLUTEN_FREE'
  | 'VEGAN'
  | 'GRILL';

export type EnvironmentalCertification =
  | 'ORGANIC'
  | 'FAIR_TRADE'
  | 'LOCAL'
  | 'SUSTAINABLE_FARMING'
  | 'ZERO_WASTE'
  | 'CARBON_NEUTRAL'
  | 'B_CORP';

export type OperatingDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const BUSINESS_TYPES: readonly BusinessType[] = [
  'RESTAURANT',
  'CAFE',
  'BAKERY',
  'PASTRY_SHOP',
  'GROCERY_STORE',
  'FOOD_TRUCK',
  'CATERING',
  'FARM',
  'BREWERY',
  'GAS_STATION',
  'OTHER',
];

export const SURPLUS_FOOD_TYPES: readonly SurplusFoodType[] = [
  'FRESH_PRODUCE',
  'BAKED_GOODS',
  'CAKES',
  'COOKIES',
  'CONFECTIONERY',
  'DAIRY',
  'MEAT_SEAFOOD',
  'PREPARED_MEALS',
  'PANTRY_ITEMS',
  'FROZEN',
  'ALCOHOLIC_DRINKS',
  'NON_ALCOHOLIC_DRINKS',
  'SNACKS',
  'ORGANIC',
  'GLUTEN_FREE',
  'VEGAN',
  'GRILL',
];

export const CERTIFICATIONS: readonly EnvironmentalCertification[] = [
  'ORGANIC',
  'FAIR_TRADE',
  'LOCAL',
  'SUSTAINABLE_FARMING',
  'ZERO_WASTE',
  'CARBON_NEUTRAL',
  'B_CORP',
];

export const OPERATING_DAYS: readonly OperatingDay[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
];
