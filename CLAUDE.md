# CLAUDE.md

This file is the primary context document for Claude Code when working on this repository.
Read it fully before doing anything. It overrides any default assumptions.

---

## Business Context

**StillFresh** is a food rescue marketplace for Balkan markets, modeled on the "Too Good To Go" concept.

**How it works:**
- Vendors (restaurants, bakeries, cafes, grocery stores, caterers, etc.) have surplus food at end of day
- They list it as discounted "surprise bags" on the platform
- Customers browse nearby offers, reserve one, pay in-app, and collect at the vendor's physical location
- Payment is triggered the moment the customer marks the order as picked up

**Phase 1 scope (what this codebase covers):**
- Customer pickup at vendor location only (no delivery)
- Customer confirms pickup in-app → payment is captured at that moment
- Two user roles: Customer and Vendor
- Vendor has two sub-types: standalone (UNIQUE) and multi-location chain (CHAIN)

**Primary market:** Serbia (Belgrade first)
**Secondary markets:** Croatia, Bosnia, other Balkan countries (same codebase, language/locale config)
**Development location:** Germany (see geo testing section below)

---

## Functional Specification

The complete screen-by-screen specification is in `spec/APP_SPEC.md`.

Before building any screen, read the relevant section of that file. It documents:
- Every screen's purpose and user role
- Exact API endpoints, HTTP methods, request bodies, and response shapes
- Navigation flows (what leads where)
- Business rules and edge cases

**Do not invent API contracts.** If a screen needs data not covered in the spec, ask before guessing.

---

## Geo Testing in Development

The app is heavily location-dependent (nearby offer search, vendor map, distance calculation).
Development happens in Germany, but the backend data and vendor locations are in Serbia.

### Solution: Mock Location Flag

A file at `src/config/devLocation.ts` controls mock coordinates:

```ts
// src/config/devLocation.ts
export const DEV_LOCATION_ENABLED = true;  // set to false before any production build

export const DEV_LOCATION = {
  latitude: 44.7866,   // Belgrade city center
  longitude: 20.4489,
  accuracy: 10,
};
```

The `GeolocationProvider` must check this flag on every location read:

```ts
import { DEV_LOCATION_ENABLED, DEV_LOCATION } from '../config/devLocation';

const getLocation = async () => {
  if (__DEV__ && DEV_LOCATION_ENABLED) {
    return DEV_LOCATION;
  }
  // ...real Expo Location call
};
```

### Rules for geo testing

- `DEV_LOCATION_ENABLED = true` is the default during development
- Set it to `false` to test with real device GPS (e.g., when testing on Android in Berlin to verify real location works)
- **Never commit `DEV_LOCATION_ENABLED = true` to a production branch**
- Add a lint rule or CI check that fails if `DEV_LOCATION_ENABLED = true` on the `main` branch
- The mock location is Belgrade (44.7866, 20.4489); change coordinates in `devLocation.ts` to test other Serbian cities

### Alternative: Per-user test locations

If you want to test multiple cities simultaneously, extend `devLocation.ts`:

```ts
export const TEST_LOCATIONS = {
  belgrade:   { latitude: 44.7866, longitude: 20.4489 },
  novi_sad:   { latitude: 45.2671, longitude: 19.8335 },
  berlin:     { latitude: 52.5200, longitude: 13.4050 },  // to test "no offers nearby"
};

export const DEV_LOCATION = TEST_LOCATIONS.belgrade;
```

---

## Tech Stack

### Framework
**Expo (managed workflow)** with React Native and TypeScript.

- `expo start` — start dev server (Expo Go or dev client)
- `eas build` — cloud build for Android APK / iOS IPA
- Never run `npx react-native ...` commands — use Expo equivalents

### Language
**TypeScript strict mode** everywhere. No `any` types. No `// @ts-ignore` without a comment explaining why.

### Navigation
**React Navigation v6** — Stack Navigator + Bottom Tab Navigator.

```
RootStack (Stack)
  AuthStack (Stack)         — Login, Register, Password Reset, etc.
  OnboardingStack (Stack)   — Vendor onboarding steps
  CustomerTabs (Bottom Tab) — Home, Favorites, Orders, Profile
  VendorTabs (Bottom Tab)   — Dashboard, Offers, Analytics, Profile
```

No manual state-machine navigation (the old app did this — do not repeat it).
Every screen gets typed params via `RootStackParamList`.

### State Management
**Zustand** for global state (auth, notifications, location).
React local state (`useState`) for screen-level UI state.
No Redux. No MobX.

### API Client
**Axios** with a custom instance at `src/services/apiClient.ts`.

Requirements for the API client:
- Base URL from `src/config/api.ts` (dev vs. prod)
- `Authorization: Bearer {token}` header injected automatically
- Request interceptor: proactively refresh JWT if it expires within 5 minutes
- Response interceptor: on 401, attempt token refresh once; on second 401, log out
- 30-second timeout on all requests
- Typed response wrappers

```ts
// src/config/api.ts
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8080'
  : 'https://api.stillfresh.com';
```

### Forms & Validation
**React Hook Form** + **Zod** for all forms.

- Define Zod schemas for every form
- Use `zodResolver` from `@hookform/resolvers/zod`
- Never validate manually with `if (!email.includes('@'))` — use Zod schemas

### Styling
**NativeWind v4** (Tailwind CSS for React Native).

- All styling via Tailwind class strings on components
- No `StyleSheet.create()` — use NativeWind
- Colors defined in `tailwind.config.js` under `theme.extend.colors`
- No hardcoded hex values anywhere in component files

### Secure Storage
**Expo SecureStore** for JWT tokens.
**AsyncStorage** only for non-sensitive data (user preferences, language).

```ts
// Store token
await SecureStore.setItemAsync('auth_token', token);
await SecureStore.setItemAsync('refresh_token', refreshToken);
```

### Location
**Expo Location** with the dev mock override described above.

### Push Notifications
**Expo Notifications** (wraps Firebase FCM under the hood).
Register FCM token with backend at `POST /api/notifications/fcm-token/register` after login.

### Payments
**@stripe/stripe-react-native** — requires Expo dev client (not Expo Go).
Wrap the app in `<StripeProvider publishableKey={...}>`.
Merchant ID: `merchant.com.stillfresh` (iOS Apple Pay).
URL scheme: `stillfresh` (for Stripe return deep links).

### Maps
**react-native-maps** via Expo.
Default center: Belgrade (44.7866, 20.4489) when location unavailable.

### Image Picker
**expo-image-picker** for vendor offer image selection and upload.

### Internationalization
**react-i18next** + **i18next**.
Supported locales: `en`, `sr`, `hr`, `bh`.
Translation files in `src/localization/languages/{locale}.json`.
Default locale: `sr` (Serbian).

---

## Project Structure

```
src/
  components/         # Reusable UI components (Button, Input, Card, Badge, etc.)
  config/             # api.ts, stripe.ts, devLocation.ts, firebase.ts
  hooks/              # Custom React hooks (useAuth, useLocation, useOffers, etc.)
  localization/       # i18n setup + language JSON files
  navigation/         # RootNavigator, AuthStack, CustomerTabs, VendorTabs + param types
  screens/            # One folder per flow
    auth/             # Login, Register, RoleSelection, PasswordReset
    customer/         # CustomerHome, NearbyOffers, OfferDetails, Favorites, Orders, etc.
    vendor/           # VendorDashboard, CreateOffer, Analytics, etc.
    vendor/onboarding/# VendorTypeSelection, HQSetup, BankingModel, etc.
    vendor/finance/   # PaymentSettings, Balance, Payouts, Transactions, etc.
    shared/           # NotificationScreen, PersonalInfo, PaymentMethods, etc.
  services/           # One file per API domain (authService, offerService, orderService, etc.)
  stores/             # Zustand stores (authStore, notificationStore, locationStore)
  theme/              # Color tokens, typography scale, spacing (mirrors tailwind.config.js)
  types/              # Shared TypeScript types and interfaces (User, Offer, Order, etc.)
  utils/              # formatCurrency, formatDate, formatPickupTime, etc.
spec/
  APP_SPEC.md         # Full functional specification (read before building any screen)
```

---

## Commands

```bash
# Start development server
npx expo start

# Start with cache cleared
npx expo start --clear

# Run on Android (connected device or emulator)
npx expo run:android

# Run on iOS (macOS only)
npx expo run:ios

# Build for Android (via EAS)
eas build --platform android --profile preview

# Type check
npx tsc --noEmit

# Lint
npx eslint src/

# Tests
npx jest
```

---

## API Conventions

- All endpoints documented in `spec/APP_SPEC.md` section 13
- Dev base URL: `http://localhost:8080` | Prod: `https://api.stillfresh.com`
- Notification endpoints have `/api` prefix; all others do not
- All monetary amounts from API are in **cents** (smallest currency unit) — format with `formatCurrency()` utility before displaying
- Pickup times from API are `HH:MM:SS` — strip seconds for display
- Pickup dates from API are `YYYY-MM-DD` — the UI should show a human-readable format
- When sending dates to backend: `YYYY-MM-DD`; when sending times: `HH:MM:SS`

---

## Auth Flow

```
Not authenticated:
  Login (default) ──> RoleSelection ──> CustomerRegister | VendorRegister
  Login ──> RequestPasswordReset ──> (back to Login)
  Deep link ──> ConfirmPasswordReset

Authenticated as Customer:
  Customer Tab Navigator

Authenticated as Vendor:
  Check GET /vendors/onboarding/status
    COMPLETED + profileCompleted=true  ──> Vendor Tab Navigator
    COMPLETED + profileCompleted=false ──> VendorProfileCompletion ──> Vendor Tab Navigator
    not COMPLETED                      ──> Vendor Onboarding Stack
```

Deep link scheme: `stillfresh://`
Handles:
- `stillfresh://auth/reset-password?token={token}` — password reset confirmation
- `stillfresh://vendors/stripe/return` — Stripe Connect onboarding return
- `stillfresh://vendors/stripe/refresh` — Stripe Connect onboarding refresh

---

## Coding Rules

1. **TypeScript strict** — every function parameter and return type must be typed
2. **No hardcoded strings visible to users** — use i18n translation keys
3. **No hardcoded colors** — use Tailwind config tokens only
4. **No hardcoded coordinates** — use `devLocation.ts` config or GeolocationProvider
5. **All API calls go through the Axios instance** in `src/services/apiClient.ts` — never use `fetch` directly
6. **One service file per API domain** — `authService.ts`, `offerService.ts`, `orderService.ts`, etc.
7. **Screens are thin** — business logic and API calls belong in hooks or services, not in screen components
8. **Error handling at service level** — catch and rethrow typed errors; screens show messages, not raw error objects
9. **Never store tokens in AsyncStorage** — use Expo SecureStore for anything sensitive
10. **Currency display** — always use `formatCurrency(amountInCents, currency)` utility, never format manually
11. **`DEV_LOCATION_ENABLED` must be `false` before any production build**
12. **Universal screen size support** — every screen must work correctly across all Android (and iOS) sizes. Rules:
    - Never hardcode pixel values for status bar height, notch, or home indicator — always use `useSafeAreaInsets()` from `react-native-safe-area-context`
    - Any UI element positioned near the top edge must be offset by `insets.top`; near the bottom edge by `insets.bottom`
    - Never hardcode `paddingTop: 56` or similar magic numbers for headers — derive from `insets.top + desired_padding`
    - Use `flex: 1` and percentage/flex layouts over fixed pixel dimensions wherever the content should stretch
    - Test mental model: the design must hold on a small phone (360×640dp), a normal phone (390×844dp), and a large phone (430×932dp)

---

## Vendor Business Rules (read before building vendor screens)

- **UNIQUE vendor** — single location, one Stripe account, no chain features
- **CHAIN vendor** — multiple locations; can be HEADQUARTERS or non-HQ location
- **HEADQUARTERS** — admin of the chain; can manage all locations and workers
- **Non-HQ chain location** — can only manage their own offers and workers
- **VENDOR_ADMIN role** — has access to payment settings, analytics, chain management
- **VENDOR role** (worker) — can only create/manage offers at their assigned location; no admin features
- **Banking models:**
  - `SHARED` — all chain locations share the HQ's Stripe account; payments route to HQ
  - `INDIVIDUAL` — each chain location has its own Stripe account

---

## Payment Flow (Phase 1)

1. Customer places order → `POST /orders/place-order` → backend creates a **payment intent** (authorized but not captured)
2. Customer picks up food at vendor location
3. Customer marks order as picked up → `PUT /orders/{orderId}/confirm-pickup`
4. Backend **captures** the authorized payment intent → money moves
5. Vendor sees earnings in their Stripe/MoR balance

**Key:** Payment is authorized at order time but captured only on pickup confirmation. Never capture early.

---

## Known Issues from Previous Implementation (avoid repeating these)

- Do not use a manual state-machine for navigation — use React Navigation
- Do not compute `pickupDaySlot` or `pickupMealSlot` client-side — these are provided by the backend in the offer object; display them as-is
- Do not hardcode Belgrade coordinates in component files — always use the GeolocationProvider or devLocation config
- Do not store JWT in AsyncStorage — use SecureStore
- Do not mix `firstName`/`lastName` and `name` field naming — the backend returns both in different contexts; the `User` type should handle both and normalize on read
