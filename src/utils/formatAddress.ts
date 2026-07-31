/**
 * Builds a business address string from parts.
 * Used in VendorRegisterScreen.
 */
export function buildBusinessAddress(
  streetNumber: string,
  streetName: string,
  city: string,
  state: string,
  zipCode: string,
): string {
  const parts = [
    streetName && streetNumber ? `${streetName} ${streetNumber}` : streetName || streetNumber,
    zipCode && city ? `${zipCode} ${city}` : city,
    state,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Builds a headquarters address string from parts.
 * Used in HeadquartersSetupScreen.
 */
export function buildHQAddress(street: string, city: string, country: string): string {
  return [street, city, country].filter(Boolean).join(', ');
}
