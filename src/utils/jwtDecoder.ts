// Used exclusively by the Axios request interceptor in apiClient.ts to check
// whether the JWT is close to expiry. Not for auth decisions — the backend is authoritative.

export interface JWTPayload {
  exp?: number;
  sub?: string;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Base64-decodes the JWT payload segment and returns the parsed object.
 * Returns null if the token is malformed or cannot be decoded.
 */
export function decodeJWTPayload(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // React Native's atob equivalent: base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token expires within the given number of seconds.
 * Returns false (not expiring soon) when the token cannot be decoded,
 * so the request still proceeds.
 */
export function isTokenExpiringSoon(token: string, withinSeconds = 300): boolean {
  const payload = decodeJWTPayload(token);
  if (!payload?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < withinSeconds;
}
