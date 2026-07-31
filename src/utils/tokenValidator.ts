/**
 * Validates that a password reset token looks structurally valid before use.
 * Not a security check — the backend validates the actual token.
 */
export function isValidResetToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token.length < 10 || token.length > 512) return false;
  // Allow alphanumeric + URL-safe characters
  return /^[A-Za-z0-9\-_%.=+]+$/.test(token);
}
