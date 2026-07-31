// ─────────────────────────────────────────────────────────────────────────────
// DEV LOCATION MOCK
//
// Set DEV_LOCATION_ENABLED = true to return mock coordinates instead of real
// device GPS. Useful when developing in Germany while backend data is in Serbia.
//
// ⚠️  NEVER commit DEV_LOCATION_ENABLED = true to the main branch.
//     A CI lint rule enforces this (see .eslintrc.js + BRANCH=main check).
// ─────────────────────────────────────────────────────────────────────────────

export const DEV_LOCATION_ENABLED = true;

export interface DevCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const TEST_LOCATIONS: Record<string, DevCoordinates> = {
  belgrade: { latitude: 44.7866, longitude: 20.4489, accuracy: 10 },
  novi_sad: { latitude: 45.2671, longitude: 19.8335, accuracy: 10 },
  berlin: { latitude: 52.52, longitude: 13.405, accuracy: 10 },
};

// Active mock location — change to test different cities
export const DEV_LOCATION: DevCoordinates = TEST_LOCATIONS.belgrade;
