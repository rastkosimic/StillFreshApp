# StillFresh Mobile — Functional Specification

> **Purpose:** This document is a complete functional and API-contract specification for the StillFresh mobile app.
> It is intended to guide a complete rewrite of the app from scratch. Design and styling are deliberately excluded —
> the new implementation should apply a fresh design system. Focus here is on **what each screen does**, **which
> endpoints it calls**, **what data flows in and out**, and **how screens connect to each other**.

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [Architecture Constraints for Rewrite](#2-architecture-constraints-for-rewrite)
3. [Global Infrastructure](#3-global-infrastructure)
4. [Navigation Model](#4-navigation-model)
5. [Auth & Registration Screens](#5-auth--registration-screens)
6. [Vendor Onboarding Flow](#6-vendor-onboarding-flow)
7. [Customer Screens](#7-customer-screens)
8. [Vendor Dashboard & Offer Management](#8-vendor-dashboard--offer-management)
9. [Vendor Chain & Worker Management](#9-vendor-chain--worker-management)
10. [Vendor Finance — Stripe Connect](#10-vendor-finance--stripe-connect)
11. [Vendor Finance — Merchant of Record (MoR)](#11-vendor-finance--merchant-of-record-mor)
12. [Customer Payments & Payment Methods](#12-customer-payments--payment-methods)
13. [Complete API Reference](#13-complete-api-reference)
14. [Data Models](#14-data-models)

---

## 1. App Overview

StillFresh is a food rescue marketplace (similar to "Too Good To Go") localized for Balkan countries, primarily Serbia.
Vendors (restaurants, bakeries, cafes, grocery stores, etc.) list surplus food at discounted prices as "surprise bags."
Customers browse nearby offers, reserve them, pay in-app, and collect within the pickup window.

**Two user roles:**
- **Customer** — browses offers, places orders, manages payment methods, tracks pickups
- **Vendor** — creates/manages offers, views orders & analytics, manages payments and payouts

**Supported languages:** English (`en`), Serbian (`sr`), Croatian (`hr`), Bosnian (`bh`)

---

## 2. Architecture Constraints for Rewrite

- React Native (target Android-first, iOS optional)
- Backend is pre-existing; the app is a client only — do not change API contracts
- Authentication: JWT access token + refresh token stored securely on device
- Token auto-refresh: proactively refresh if token expires within 5 minutes; reactively refresh on 401
- Stripe (`@stripe/stripe-react-native`) for card capture and payment processing
- Firebase FCM for push notifications
- Google Sign-In via `@react-native-google-signin/google-signin`
- Maps via `react-native-maps`
- Geolocation via `@react-native-community/geolocation`
- i18n via `react-i18next`
- No Redux — use React Context for global state

---

## 3. Global Infrastructure

### API Client

- **Dev base URL:** `http://localhost:8080`
- **Prod base URL:** `https://api.stillfresh.com`
- All endpoints are relative to the base URL
- All authenticated requests include `Authorization: Bearer {jwt}` header
- Timeout: 30 seconds
- Token storage: access token in device Keychain; refresh token in Keychain; user object in AsyncStorage

### Auth Token Lifecycle

| Event | Action |
|-------|--------|
| App foreground | Proactively refresh if token expires in <= 5 min |
| API returns 401 | Reactive refresh attempt; if refresh fails, log out |
| Login / Register | Store new token + user; start proactive refresh cycle |
| Logout | Call `POST /auth/logout`, clear Keychain + AsyncStorage |

### Context Providers (wrap entire app)

| Context | Manages |
|---------|---------|
| `AuthContext` | JWT token, user object, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshUser` |
| `NotificationContext` | FCM token registration, unread count, notification preferences |
| `GeolocationContext` | Device coordinates, location permission state |
| `LanguageContext` | Active language code, `changeLanguage` |

### Provider Hierarchy

```
SafeAreaProvider
  GestureHandlerRootView
    StripeProvider  (publishableKey, merchantId: merchant.com.stillfreshmobile, urlScheme: stillfreshmobile)
      LanguageProvider
        AuthProvider
          NotificationProvider
            GeolocationProvider
              <App screens>
```

### Notification Initialization

After login, register FCM token with backend (`POST /api/notifications/fcm-token/register`) with a short delay (~300ms) to ensure Firebase is ready. Re-register on each login. Clear registration state on logout.

---

## 4. Navigation Model

There is no third-party navigation library (no React Navigation). Navigation is a manual state machine in the root component:

- `currentScreen` state variable controls which screen component is rendered
- Screens receive a `navigation` prop: `{ navigate(screenName, params), goBack() }`
- `App.tsx` `AuthFlow` component is the state machine root

### Auth Flow Routing Logic

```
Not authenticated:
  → Login (default)
  → RoleSelection → CustomerRegister | VendorRegister
  → RequestPasswordReset → (back to Login)
  → ConfirmPasswordReset (via deep link: stillfresh://auth/reset-password?token=...)

Authenticated as Customer:
  → CustomerMainScreen (tab-based internal navigation)

Authenticated as Vendor:
  → Check onboarding status (GET /vendors/onboarding/status)
    → If not COMPLETED: OnboardingFlowScreen
    → If COMPLETED but profileCompleted=false: VendorProfileCompletionScreen
    → If COMPLETED and profileCompleted=true: VendorMainScreen
```

### Deep Links

| URL Pattern | Action |
|-------------|--------|
| `stillfresh://auth/reset-password?token={token}` | Open ConfirmPasswordResetScreen with token |
| `stillfresh://vendors/stripe/return` | Handle Stripe Connect onboarding return |
| `stillfresh://vendors/stripe/refresh` | Handle Stripe Connect onboarding refresh |

---

## 5. Auth & Registration Screens

---

### LoginScreen

**Role:** Unauthenticated
**Purpose:** Entry point for existing users. Supports email/password and Google OAuth login.
**Navigates from:** App start (default unauthenticated state)
**Navigates to:** CustomerMainScreen or VendorMainScreen (based on `user.role` after login)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Email/password login | POST | `/auth/login` | `{ identifier: string, password: string }` | `{ jwt: string, role: string, user: User, vendor?: VendorInfo, accountWasDeleted?: boolean }` |
| Google OAuth login | POST | `/auth/google-login` | `{ idToken: string, role: "USER", isSignUp: false }` | `{ jwt: string, role: string, user: User, vendor?: VendorInfo, accountWasDeleted?: boolean }` |

#### User Interactions

- Email/username + password inputs with visibility toggle
- "Sign In" button — submits credentials
- "Forgot Password?" link — navigates to RequestPasswordResetScreen
- "Sign Up" link — navigates to RoleSelectionScreen
- Google Sign-In button — triggers Google OAuth, sends idToken to backend
- Language selector button

#### Notes

- `identifier` field accepts both email and username
- If `accountWasDeleted: true` in response, show "Welcome back!" alert
- Google login with `isSignUp: false` rejects accounts that don't exist; show "sign up first" message
- After login, store JWT in Keychain, user in AsyncStorage, then route based on role

---

### RoleSelectionScreen

**Role:** Unauthenticated
**Purpose:** New user chooses between Customer and Vendor registration path.
**Navigates from:** LoginScreen ("Sign Up" link)
**Navigates to:** CustomerRegisterScreen or VendorRegisterScreen

#### API Calls

None.

#### User Interactions

- "Customer" card — navigates to CustomerRegisterScreen
- "Vendor" card — navigates to VendorRegisterScreen
- "Sign In" link — back to LoginScreen

---

### CustomerRegisterScreen

**Role:** Unauthenticated
**Purpose:** Register a new customer account.
**Navigates from:** RoleSelectionScreen
**Navigates to:** LoginScreen (after successful registration; user must then log in)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Register customer | POST | `/users/register` | `{ username: string, email: string, password: string }` | `{ message: string }` |
| Google Sign-Up | POST | `/auth/google-login` | `{ idToken: string, role: "USER", isSignUp: true }` | `{ jwt: string, role: string, user: User }` |

#### User Interactions

- Username, email, password inputs
- "Create Account" button
- Google Sign-Up button (creates account and logs in immediately, skipping email verification)
- "Sign In" link — back to LoginScreen

#### Notes

- Email validation: must contain `@`
- Password minimum 6 characters
- On success: show "Email Verification Sent" alert, then navigate to LoginScreen
- Handle 409 Conflict: "email/username already exists"
- Google Sign-Up creates an authenticated session immediately (no email verification needed)

---

### VendorRegisterScreen

**Role:** Unauthenticated
**Purpose:** Submit a vendor application for review. Not an instant account creation — admin approves and sends credentials.
**Navigates from:** RoleSelectionScreen
**Navigates to:** LoginScreen (after application submitted)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Submit vendor application | POST | `/vendors/apply` | `{ contactName, email, phone, businessAddress, zipCode, businessRegistrationId?, notes? }` | `{ message: string }` |
| Google Sign-Up (vendor) | POST | `/auth/google-login` | `{ idToken: string, role: "VENDOR", isSignUp: true }` | `{ jwt: string, role: string, user: User, vendor: VendorInfo }` |

#### User Interactions

- Contact name, email, phone inputs (required)
- Address fields: Street number, Street name, City, State, ZIP code (combined into `businessAddress` string: `"StreetNumber StreetName, City, State, ZipCode"`)
- Optional: Business Registration ID, notes
- "Submit Application" button
- Google Sign-Up button (creates vendor account immediately, bypasses manual review)
- "Sign In" link — back to LoginScreen

#### Notes

- `businessAddress` is constructed client-side: `"{streetNumber} {streetName}, {city}, {state}, {zipCode}"`
- Application is reviewed by admin; vendor receives credentials by email
- Latitude/longitude are NOT sent (defaults to 0,0 on backend; set during onboarding)
- On success: show "Application Submitted — your application will be reviewed" alert

---

### RequestPasswordResetScreen

**Role:** Unauthenticated
**Purpose:** User enters email + desired new password to trigger a reset verification link.
**Navigates from:** LoginScreen ("Forgot Password?" link)
**Navigates to:** LoginScreen (after link sent)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Request reset | POST | `/auth/forgot-password` | `{ email: string, newPassword: string }` | Success message string |

#### User Interactions

- Email, new password (with toggle), confirm password (with toggle) inputs
- Real-time validation errors below each field
- "Send Verification Link" button (disabled until form valid)
- "Back to Login" link

#### Notes

- Password minimum 6 characters; must match confirmation
- On success: show "Verification link sent — check your inbox" alert, then navigate to LoginScreen
- Handle 404: "No account found with this email address"

---

### ConfirmPasswordResetScreen

**Role:** Unauthenticated
**Purpose:** Confirms the password reset token from the deep-link email. No user input — auto-processes on load.
**Navigates from:** Deep link `stillfresh://auth/reset-password?token={token}` (also matches `https://...auth/reset-password?token=...`)
**Navigates to:** LoginScreen (on "Go to Login" button)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Confirm reset | GET | `/auth/reset-password?token={token}` | — | `{ success: boolean, message: string, email?: string }` |

#### User Interactions

- Loading spinner on mount while verifying token
- Success state: checkmark icon, "Password Reset Successful!", email shown
- Error state: X icon, "Password Reset Failed", error message
- "Go to Login" button

#### Notes

- Token extracted from deep link URL; validated (alphanumeric + safe chars, 10–512 chars) before sending
- No user input required during confirmation
- Error messages: invalid token, expired token, no reset request found

---

### AuthenticatedPasswordResetScreen

**Role:** Customer / Vendor (authenticated)
**Purpose:** Logged-in user changes their password. User is logged out after submission.
**Navigates from:** Profile / account settings menu
**Navigates to:** LoginScreen (after automatic logout)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Change password | POST | `/auth/change-password` | `{ email: string, newPassword: string, confirmPassword: string }` | Success message string |

#### User Interactions

- Email field (pre-filled from authenticated user, effectively read-only)
- New password + confirmation inputs (both with visibility toggles)
- Yellow warning banner: "You will be logged out after submitting"
- "Reset Password" button — shows confirmation dialog before submitting
- Confirmation dialog: "Cancel" or "Continue" (destructive)

#### Notes

- `email` must match `user.email` from AuthContext; rejects mismatches
- After success: clear auth storage, call `logout()`, show "verification link sent" alert, go to LoginScreen
- Handle 400: email mismatch, password mismatch, password too short
- Handle 401: "Session expired, please log in again"

---

## 6. Vendor Onboarding Flow

New vendors must complete a multi-step onboarding before accessing the vendor dashboard. The flow is orchestrated by `OnboardingFlowScreen`, which checks status after each step and renders the next screen.

### Onboarding Status State Machine

```
PENDING_VERIFICATION  →  (waiting for admin approval, show message)
VERIFIED              →  VendorTypeSelectionScreen
TYPE_SELECTED         →  HeadquartersSetupScreen (CHAIN) | BankingModelSelectionScreen (UNIQUE)
HEADQUARTERS_ADDED    →  BankingModelSelectionScreen
BANKING_SETUP         →  PaymentAccountSetupScreen
PAYMENT_CONFIGURED    →  OnboardingCompleteScreen
COMPLETED             →  Exit onboarding → VendorProfileCompletionScreen
```

---

### OnboardingFlowScreen

**Role:** Vendor
**Purpose:** Container/orchestrator that checks current onboarding status and renders the appropriate step screen.
**Navigates from:** App.tsx when vendor is authenticated and onboarding is not COMPLETED
**Navigates to:** Renders child steps internally; on COMPLETED calls `onComplete` → VendorProfileCompletionScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get onboarding status | GET | `/vendors/onboarding/status` | — | `{ status: OnboardingStatus, isChainLocation: boolean, isUniqueVendor: boolean, chainName: string, isHeadquarters: boolean, usesSharedPaymentAccount: boolean }` |

#### Notes

- Refreshes status after each step to determine next screen
- Shows spinner while loading
- Shows "Pending Verification" message if status is `PENDING_VERIFICATION`
- Back navigation is not permitted (enforced in App.tsx)

---

### VendorTypeSelectionScreen

**Role:** Vendor
**Purpose:** Step 1 — vendor selects CHAIN (multi-location) or UNIQUE (single-location). CHAIN vendors must provide a chain name.
**Navigates from:** OnboardingFlowScreen (status = VERIFIED)
**Navigates to:** HeadquartersSetupScreen (CHAIN) or BankingModelSelectionScreen (UNIQUE)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Set vendor type | POST | `/vendors/onboarding/set-vendor-type` | `{ vendorType: "CHAIN" | "UNIQUE", chainName: string | null }` | `{ success: boolean, message: string }` |

#### User Interactions

- Two selection cards: UNIQUE and CHAIN
- If CHAIN selected: text input for chain name (required)
- "Continue" button (disabled until type selected and chain name filled if applicable)

---

### HeadquartersSetupScreen

**Role:** Vendor (CHAIN only)
**Purpose:** Step 2 (CHAIN only) — provide headquarters location details. Address is auto-geocoded.
**Navigates from:** OnboardingFlowScreen (status = TYPE_SELECTED, isChainLocation = true)
**Navigates to:** BankingModelSelectionScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Add headquarters | POST | `/vendors/onboarding/add-headquarters` | `{ locationName, address, zipCode, latitude, longitude, phone?, country }` | `{ success: boolean, message: string }` |
| Geocode address | (Google Maps via react-native-geocoding) | — | `{ streetNumber, streetName, city, country, zipCode }` | `{ latitude, longitude, formattedAddress, countryCode }` |

#### User Interactions

- Inputs: Location Name, Street & Number, City, Country, ZIP Code, Phone (optional)
- Geocoding triggers automatically 1 second after all required address fields are filled (debounced)
- Coordinates display section shows: finding / found / error states
- "Continue" disabled until coordinates found and all fields valid

#### Notes

- `address` sent to backend as `"street, city, country"` (no ZIP)
- Country name converted to uppercase country code (e.g., "Germany" → "GERMANY")
- Geocoding uses Google Maps API; fallback tries address variations if primary fails

---

### BankingModelSelectionScreen

**Role:** Vendor
**Purpose:** Step 3 — select banking model: SHARED (all locations share HQ payment account) or INDIVIDUAL (each location has own account). UNIQUE vendors must also provide their country.
**Navigates from:** OnboardingFlowScreen (status = TYPE_SELECTED for UNIQUE, or HEADQUARTERS_ADDED for CHAIN)
**Navigates to:** PaymentAccountSetupScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get status (to determine vendor type) | GET | `/vendors/onboarding/status` | — | `OnboardingStatusResponse` |
| Set banking model | POST | `/vendors/onboarding/set-banking-model` | `{ bankingModel: "SHARED" | "INDIVIDUAL", country?: string }` | `{ success: boolean, message: string }` |

#### User Interactions

- Two option cards: SHARED (CHAIN vendors only) and INDIVIDUAL (all)
- SHARED option is hidden for UNIQUE vendors
- UNIQUE vendors: text input for Country (required)
- "Continue" button

#### Notes

- SHARED model: all payments route to HQ Stripe account; locations cannot have individual accounts
- INDIVIDUAL model: each location sets up their own Stripe account
- Country is required for UNIQUE vendors (used for Stripe account creation)
- Country name converted to country code client-side

---

### PaymentAccountSetupScreen

**Role:** Vendor
**Purpose:** Step 4 — trigger asynchronous Stripe Connect account creation. No user input required.
**Navigates from:** OnboardingFlowScreen (status = BANKING_SETUP)
**Navigates to:** OnboardingCompleteScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Setup payment account | POST | `/vendors/onboarding/setup-payment-account` | `{}` | `{ success: boolean, message: string }` |

#### User Interactions

- Info card explains: setup is async, country data from onboarding is used, vendor will be notified
- "Setup Payment Account" button — triggers the process

#### Notes

- Backend creates Stripe Connect account asynchronously
- Vendor will receive FCM notification when account is ready
- No further input needed from vendor at this step

---

### OnboardingCompleteScreen

**Role:** Vendor
**Purpose:** Final step — confirm onboarding completion. Marks status as COMPLETED on backend.
**Navigates from:** OnboardingFlowScreen (status = PAYMENT_CONFIGURED)
**Navigates to:** App.tsx `onComplete` callback → VendorProfileCompletionScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Complete onboarding | POST | `/vendors/onboarding/complete` | `{}` | `{ success: boolean, message: string }` |

#### User Interactions

- Success icon + congratulatory message
- Info card listing what vendor can do next (create offers, analytics, manage locations if CHAIN)
- "Complete Onboarding" button

---

### VendorProfileCompletionScreen

**Role:** Vendor
**Purpose:** Optional post-onboarding step to fill in vendor profile details (business type, hours, food types, certifications, image). Can be skipped.
**Navigates from:** App.tsx after onboarding completion when `user.profileCompleted = false`
**Navigates to:** VendorMainScreen (on complete or skip)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Update vendor profile | PUT | `/vendors/update-profile` | `{ businessType?, operatingHours?: string[], surplusFoodDetails?: string[], environmentalCertifications?: string, imageUrl?: string }` | — |
| Mark profile completed (skip) | POST | (via vendorService.markProfileCompleted) | — | — |

#### User Interactions

- Business Type selector: pills — Restaurant, Cafe, Bakery, Grocery Store, Food Truck, Catering, Farm, Other
- Operating Hours: multi-select checkboxes (Mon–Sun)
- Surplus Food Details: multi-select checkboxes (12 types: fresh produce, baked goods, dairy, meat/seafood, prepared meals, pantry items, frozen, beverages, snacks, organic, gluten-free, vegan)
- Environmental Certifications: multi-select checkboxes (7 types: organic, fair trade, local, sustainable farming, zero waste, carbon neutral, B Corp)
- Business Image: image picker (gallery) — uploads to server
- "Update Profile" button — submits and proceeds
- "Skip For Now" button — marks profile completed without submitting data

#### Notes

- All fields optional
- `environmentalCertifications` sent as comma-separated string (not array)
- Skip calls `markProfileCompleted` to prevent the screen appearing again on next login

---

## 7. Customer Screens

---

### CustomerMainScreen

**Role:** Customer
**Purpose:** Home dashboard. Shows nearby offers with category filtering and distance-based discovery. Contains tab navigation for Home, Favorites, Basket (Orders), History, Profile, and Notifications.
**Navigates from:** App.tsx (authenticated customer)
**Navigates to:** NearbyOffersScreen, OfferDetailsScreen, FavoritesScreen, OrdersScreen, OrderHistoryScreen, PersonalInfoScreen, NotificationScreen, AddCardScreen, AuthenticatedPasswordResetScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Load nearby offers | GET | `/customers/search-nearby` | `?latitude=&longitude=&range=20&sort=distance&category=` | `{ offers: Offer[] }` |
| Load categories | GET | `/categories` | `?language={lang}` | `Category[]` |

#### User Interactions

- **Home tab**: Nearby offers list sorted by distance; pull-to-refresh; category filter pills at top
- **Offer card**: tap → OfferDetailsScreen; favorite button → toggle favorite
- **Favorites tab**: navigate to FavoritesScreen
- **Basket tab**: navigate to OrdersScreen (active orders)
- **History tab**: navigate to OrderHistoryScreen
- **Profile tab**: menu with links to PersonalInfo, PaymentMethods, PasswordReset, Notifications, Language, Delete Account
- **Delete Account**: modal with reason dropdown + optional message → `DELETE /users/delete`

#### Notes

- Location permission requested on mount; required for offer discovery
- Offers are grouped by pickup slot using backend-provided `pickupDaySlot` and `pickupMealSlot` fields — do NOT compute this client-side
- `greyedOut: true` offers are expired/sold-out and excluded from normal sections
- Categories are language-aware; reload when language changes

---

### NearbyOffersScreen

**Role:** Customer
**Purpose:** Full-screen nearby offer search with distance/price/rating sorting, range filtering, and map/list view toggle.
**Navigates from:** CustomerMainScreen
**Navigates to:** OfferDetailsScreen, OrdersScreen (after order placed)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Search nearby | GET | `/customers/search-nearby` | `?latitude=&longitude=&range=&sort=` | `{ offers: Offer[] }` |
| Get payment methods | GET | `/customers/payment-methods` | — | `CustomerPaymentMethod[]` |
| Place order | POST | `/orders` | `{ offerId: string, quantity: number }` | `{ order: Order, paymentIntentId: string, message: string }` |

#### User Interactions

- Range slider modal (1–100 km)
- Sort dropdown: `distance`, `price_asc`, `price_desc`, `rating_desc`
- List/Map view toggle
- Offer card tap → order placement flow (check payment methods first, then quantity modal)
- Quantity modal: input + confirm
- Pull-to-refresh

#### Notes

- Falls back to Belgrade coordinates (44.7866, 20.4489) if location unavailable
- Payment methods checked before allowing order; alerts if none exist
- Order quantity: 1 ≤ qty ≤ offer.availableQuantity

---

### OfferDetailsScreen

**Role:** Customer
**Purpose:** Full detail view of a single offer with vendor rating, pricing, dietary/allergen info, and reservation.
**Navigates from:** CustomerMainScreen, NearbyOffersScreen, FavoritesScreen
**Navigates to:** OrdersScreen (after successful order)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get vendor rating | GET | `/vendors/{vendorId}/rating-summary` | — | `{ averageRating, totalRatings, averageCollectionProcessRating, ... }` |
| Get payment methods | GET | `/customers/payment-methods` | — | `CustomerPaymentMethod[]` |
| Create order | POST | `/orders` | `{ offerId: string, quantity: number }` | `{ order: Order, paymentIntentId: string, message: string }` |

#### User Interactions

- Hero image with parallax scroll effect
- Sticky header appears after scrolling past hero
- "Reserve" button → payment methods check → quantity input modal → confirm → place order
- Favorite toggle button
- Share button (native share sheet with offer name, vendor, time, address)

#### Notes

- Vendor rating fetch is non-blocking; defaults to zero if it fails
- Payment methods must exist before reservation; show error alert if none
- Pickup window is read-only (set by vendor)

---

### FavoritesScreen

**Role:** Customer
**Purpose:** List all favorited offers. Shows expired/sold-out indicators. Allows removal.
**Navigates from:** CustomerMainScreen (Favorites tab)
**Navigates to:** OfferDetailsScreen (active offers only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get favorites | GET | `/users/favorites` | `?page=0&limit=100` | `{ favorites: FavoriteOffer[], expiredCount: number, soldOutCount: number }` |
| Remove favorite | DELETE | `/users/favorites/{offerId}` | — | 200 OK |

#### User Interactions

- Offer card tap → OfferDetailsScreen (disabled if `greyedOut`)
- Favorite/heart button → toggle off removes from favorites immediately (local + API)
- Pull-to-refresh
- Banner at top if expired/sold-out count > 0

#### Notes

- All 100 favorites loaded in single request (no pagination on this screen)
- `greyedOut: true` offers shown with reduced opacity and "Remove" button
- On remove: filter immediately from local state

---

### OrdersScreen (Basket)

**Role:** Customer
**Purpose:** Active orders in flight: PENDING, CONFIRMED, PROCESSING, READY. Supports cancellation and pickup confirmation.
**Navigates from:** CustomerMainScreen (Basket tab)
**Navigates to:** OfferDetailsScreen (tap offer in order)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get orders (paginated) | GET | `/orders?page={page}&size=20` | — | `Page<Order>` |
| Get offer details | GET | `/offers/{offerId}` | — | `Offer` |
| Cancel order | PUT | `/orders/{orderId}/cancel` | `{ reason?: string }` | `{ success: boolean, message: string }` |
| Confirm pickup | PUT | `/orders/{orderId}/confirm-pickup` | — | `{ success: boolean, message: string }` |

#### User Interactions

- Order cards with color-coded status badges (Pending, Confirmed, Processing, Ready)
- Tap offer in card → view offer details modal
- "Cancel" button → confirmation modal with optional reason text input
- "Confirm Pickup" button (READY orders only) → triggers payment capture on backend
- Pull-to-refresh; infinite scroll pagination (page size 20)

#### Notes

- Basket = orders with status in `[PENDING, CONFIRMED, PROCESSING, READY]`
- Offer details fetched lazily in background (stream as they arrive)
- Removed/cancelled orders tracked client-side to avoid re-appearing on pagination
- Pickup confirmation only available for READY orders with a `paymentIntentId`

---

### OrderHistoryScreen

**Role:** Customer
**Purpose:** Past orders in two tabs: Completed (realized) and Unrealized (cancelled/expired).
**Navigates from:** CustomerMainScreen (Profile → My Orders)
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get all orders (paginated) | GET | `/orders?page={page}&size=20` | — | `Page<Order>` |
| Get offer details | GET | `/offers/{offerId}` | — | `Offer` |

#### User Interactions

- Tab: "Completed" (COMPLETED status orders)
- Tab: "Unrealized" (CANCELLED, EXPIRED status orders)
- Tab badges show order count per tab
- Pull-to-refresh; infinite scroll pagination

#### Notes

- Split client-side by status after fetching
- Payment status shown: "Payment authorized" (has `paymentIntentId`) or "Payment on pickup"
- Offer details fetched lazily in background

---

### NotificationScreen

**Role:** Customer / Vendor
**Purpose:** View, manage, and configure push notifications. Supports per-type preferences and test notification.
**Navigates from:** CustomerMainScreen or VendorMainScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get notifications | GET | `/api/notifications/user` | — | `{ success: boolean, data: Notification[] }` |
| Mark as read | POST | `/api/notifications/mark-read/{id}` | — | `{ success: boolean, message: string }` |
| Mark all read | POST | `/api/notifications/mark-all-read` | — | `{ success: boolean, message: string }` |
| Delete notification | DELETE | `/api/notifications/{id}` | — | 200 OK |
| Get preferences | GET | `/api/notifications/preferences` | — | `{ success: boolean, data: NotificationPreferences }` |
| Update preferences | POST | `/api/notifications/preferences` | `{ enabledTypes: string[], pushEnabled: boolean, emailEnabled: boolean, smsEnabled: boolean }` | `{ success: boolean, data: NotificationPreferences }` |
| Send test notification | POST | `/api/notifications/test` | — | `{ success: boolean, message: string }` |

#### User Interactions

- Notification list with unread state (visual highlight on unread)
- Tap notification → mark as read
- Long-press → menu: "Mark as Read", "Delete"
- "Mark All Read" button
- Preferences section: global toggles (push/email/SMS) + per-type enable/disable
- "Send Test Notification" button
- Pull-to-refresh

#### Notes

- Notification types: `ORDER_CONFIRMED`, `ORDER_CANCELLED`, `ORDER_EXPIRED`, `ORDER_PICKUP_REMINDER`, `PAYMENT_SUCCESSFUL`, `OFFER_AVAILABLE`, `OFFER_EXPIRED`, `PICKUP_REMINDER`, `VENDOR_UPDATE`, `SYSTEM_ANNOUNCEMENT`, `SYSTEM_ALERT`
- Timestamps: "Xm ago", "Xh ago", "Xd ago", or full date for older items
- Unread state: highlighted visually (left border + background tint)

---

### PersonalInfoScreen

**Role:** Customer
**Purpose:** Read-only display of all profile fields with edit entry points.
**Navigates from:** CustomerMainScreen (Profile menu)
**Navigates to:** EditPersonalInfoFieldScreen (per-field tap)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get profile | GET | `/users` | — | `User` (full profile) |

#### User Interactions

- Each field row (Name, Email, Phone, Address, Country, Birthday, Dietary Preference) is tappable → EditPersonalInfoFieldScreen
- Shows current value or "Not set" placeholder
- Pull-to-refresh

#### Notes

- Fetched on mount; merges with AuthContext user (never overwrites role/vendor data)
- Handles multiple backend field naming conventions: `name` OR `firstName`/`lastName`; `phone` OR `phoneNumber`; `country` OR `countryCode`

---

### EditPersonalInfoFieldScreen

**Role:** Customer
**Purpose:** Edit a single profile field with validation and backend persistence.
**Navigates from:** PersonalInfoScreen (field tap)
**Navigates to:** PersonalInfoScreen (on save or back)

#### API Calls

All fields use `PUT /users` with the relevant field in the request body:

| Field | Request Body |
|-------|-------------|
| Name | `{ firstName: string, lastName: string }` |
| Email | `{ email: string }` |
| Phone | `{ phoneNumber: string }` |
| Address | `{ address: string }` |
| Country | `{ country: string }` |
| Birthday | `{ birthday: string }` (format: `YYYY-MM-DD`) |
| Dietary Preference | `{ dietaryPreference: string }` |

**Response:** Updated `User` object

#### User Interactions

- Name field: two separate inputs (firstName, lastName)
- Birthday: text input with placeholder `YYYY-MM-DD`; client-side format validation with red error text
- Clear button (X icon) on each input
- "Save" button — disabled while saving; navigates back on success
- Back button — no save

#### Notes

- Birthday validation: must match `YYYY-MM-DD` regex; empty is allowed
- All values trimmed before sending
- AuthContext user refreshed after save

---

## 8. Vendor Dashboard & Offer Management

---

### VendorMainScreen

**Role:** Vendor (VENDOR_ADMIN)
**Purpose:** Central vendor dashboard with quick actions, account management, and conditional features based on vendor type (chain/unique) and role (admin/worker).
**Navigates from:** App.tsx (authenticated vendor, onboarding complete)
**Navigates to:** CreateOfferScreen, VendorAllOffersScreen, VendorAnalyticsScreen, NotificationScreen, PaymentSettingsScreen, ChainLocationManagementScreen, WorkerManagementSelectionScreen, BankingModelManagementScreen, UpgradeToChainScreen, OnboardingFlowScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Check onboarding status | GET | `/vendors/onboarding/status` | — | `{ status: OnboardingStatus, isUniqueVendor: boolean, isHeadquarters: boolean }` |
| Delete account | DELETE | `/vendors/delete` | `{ reason?: string, message?: string }` | success message |

#### User Interactions

- "Create New Listing" → CreateOfferScreen
- "View All Offers" → VendorAllOffersScreen
- "View Analytics" → VendorAnalyticsScreen
- "Notifications" (with unread badge) → NotificationScreen
- "Manage Profile / Payment Settings" (VENDOR_ADMIN only) → PaymentSettingsScreen
- "Banking Model Management" (VENDOR_ADMIN + CHAIN only) → BankingModelManagementScreen
- "Manage Locations" (VENDOR_ADMIN + Headquarters only) → ChainLocationManagementScreen
- "Manage Workers" (VENDOR_ADMIN + CHAIN only) → WorkerManagementSelectionScreen
- "Upgrade to Chain" (VENDOR_ADMIN + UNIQUE only) → UpgradeToChainScreen
- "Delete Account" → confirmation modal with reason/feedback → delete + logout

#### Notes

- Workers (role=VENDOR) cannot see admin features
- If onboarding is not COMPLETED on mount, redirect to OnboardingFlowScreen
- Chain/unique status comes from `user.vendor` or onboarding status response

---

### VendorAllOffersScreen

**Role:** Vendor
**Purpose:** List all vendor offers (active, expired, sold-out) with filter tabs and per-offer actions.
**Navigates from:** VendorMainScreen
**Navigates to:** UpdateOfferScreen (tap expired/sold-out offer or "Update" action)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get all offers | GET | `/vendors/all-offers` | — | `OfferDto[]` |
| Invalidate offer | POST | `/vendors/invalidate-offer/{offerId}` | `{}` | success message string |

#### User Interactions

- Filter tabs: All / Active / Expired / Sold Out
- Tap active offer → action menu: "Invalidate" or "Update"
- Tap expired/sold-out offer → UpdateOfferScreen (for reactivation)
- "Invalidate" → confirmation alert → invalidate + refresh list
- Pull-to-refresh

#### Notes

- Status badges: Active (green), Expired (red), Sold Out (red), Inactive (gray)
- Expired/sold-out offers shown at 60% opacity

---

### CreateOfferScreen

**Role:** Vendor
**Purpose:** Create a new offer. Handles image upload, category selection, pickup time presets, and all offer fields.
**Navigates from:** VendorMainScreen ("Create New Listing")
**Navigates to:** VendorAllOffersScreen (on back or after success)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Create offer | POST | `/vendors/offer-create` | See request body below | success message string |
| Get categories | GET | `/categories?language={lang}` | — | `Category[]` |
| Upload image | POST | `/images/upload` (multipart form) | Image file binary | `{ imageUrl: string }` |

**Create Offer Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "price": 12.99,
  "originalPrice": 18.99,
  "quantityAvailable": 5,
  "pickupStartTime": "14:30:00",
  "pickupEndTime": "18:00:00",
  "pickupDate": "2025-12-17",
  "dietaryInfo": "string (optional)",
  "allergenInfo": "string (optional)",
  "imageUrl": "string (optional)",
  "category": "MEALS (optional)"
}
```

#### User Interactions

- Required fields: Name, Description, Discounted Price, Original Price, Quantity Available
- Pickup info: Date picker (DD-MM-YYYY in UI → YYYY-MM-DD to backend), Start Time, End Time
- Quick presets: "Today", "Tomorrow", "12:00-14:00", "14:00-16:00", "16:00-18:00"
- Optional: Dietary Info, Allergen Info, Category selector
- Image picker → auto-uploads on select → stores `imageUrl`; "Remove" button clears it
- Validation: highlights invalid fields in red; price must be less than original price
- "Submit" button → success alert → navigate back

#### Notes

- Time format: UI is `HH:MM`; backend expects `HH:MM:SS` (append `:00`)
- Date format: UI is `DD-MM-YYYY`; backend expects `YYYY-MM-DD`
- `pickupStartTime` must be in the future (validated server-side)
- Vendor address/ZIP are added server-side; not submitted by client

---

### UpdateOfferScreen

**Role:** Vendor
**Purpose:** Edit an existing offer or reactivate an expired/sold-out one.
**Navigates from:** VendorAllOffersScreen
**Navigates to:** VendorAllOffersScreen (on success)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Update offer | POST | `/vendors/update-offer/{offerId}` | Same shape as CreateOfferScreen | `OfferDto` or success message |

#### User Interactions

- Pre-filled form with all current offer values
- Same fields and validation as CreateOfferScreen
- Button label: "Update Offer" (active) or "Reactivate Offer" (expired/sold-out)
- Info card for expired/sold-out explains what to update

#### Notes

- Same date/time format conversions as CreateOfferScreen apply
- Reactivation: update pickup date/time to a future window and/or increase quantity

---

### OffersScreen

**Role:** Customer
**Purpose:** Browse all active offers from all vendors.
**Navigates from:** CustomerMainScreen (or direct navigation)
**Navigates to:** OfferDetailsScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get active offers | GET | `/vendors/active-offers` | — | `OfferDto[]` |

#### User Interactions

- Scrollable offer card list
- Favorite toggle per card
- Refresh button (icon)

#### Notes

- Shows vendor name, business type (translated), star rating, price/original price, quantity, dietary info, expiry countdown, pickup time, address

---

### PickupSectionOffersScreen

**Role:** Customer
**Purpose:** Show offers for a specific pickup time section (e.g., "Collect Today", "Lunch", etc.).
**Navigates from:** CustomerMainScreen (section tap)
**Navigates to:** OfferDetailsScreen

#### API Calls

None — data passed as prop from parent.

#### User Interactions

- FlatList of offer cards: image, title, vendor name, pickup window, price, "X left" badge
- Tap card → OfferDetailsScreen
- Favorite button per card

#### Notes

- "X left" badge color: red (<=3), yellow (4-5), green (>5)
- Pickup label: "Collect now", "Collect today", "Collect tomorrow", or `HH:MM - HH:MM` range

---

### VendorMapScreen

**Role:** Customer
**Purpose:** Map view of nearby vendors/offers with vendor markers, offer preview cards, and location search.
**Navigates from:** CustomerMainScreen (map tab/button)
**Navigates to:** OfferDetailsScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Search nearby offers | GET | `/offers/nearby` | `?latitude=&longitude=&range=10&sort=distance` | `{ offers: Offer[], total: number }` |

#### User Interactions

- Map with vendor markers (each shows offer count badge)
- Tap marker → show offer preview card (vendor name, price, distance, description)
- "View Offer" button on preview card → OfferDetailsScreen
- Refresh button → re-search with current location
- Location auto-centered on user or defaults to Belgrade (44.7866, 20.4489)

---

### VendorAnalyticsScreen

**Role:** Vendor
**Purpose:** Performance dashboard with metrics, revenue trend, offer performance table, active orders, ratings, and payout balance.
**Navigates from:** VendorMainScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get vendor dashboard | GET | `/vendors/{vendorId}/dashboard?period={period}` | — | See response shape below |

**Response Shape:**
```json
{
  "summary": {
    "totalUnitsSold": 150,
    "totalRevenue": 2500.00,
    "activeOrderCount": 12,
    "sellThroughRate": 0.85
  },
  "revenueTrend": [
    { "date": "2025-03-20", "revenue": 500.00 }
  ],
  "offerPerformance": [
    {
      "offerId": 1,
      "offerName": "Lunch Special",
      "active": true,
      "unitsSold": 45,
      "revenue": 1200.00,
      "quantityAvailable": 10,
      "sellThroughRate": 0.82
    }
  ],
  "activeOrders": [
    {
      "orderId": 1,
      "offerId": 10,
      "quantity": 3,
      "totalPrice": 100.00,
      "currency": "EUR",
      "status": "CONFIRMED",
      "pickupBy": "2025-03-23T18:00:00Z"
    }
  ],
  "ratings": {
    "averageRating": 4.5,
    "reviewsCount": 120
  },
  "payoutBalance": {
    "unsettledCents": 50000,
    "lastPayoutAmountCents": 30000,
    "lastPayoutAt": "2025-03-15T00:00:00Z",
    "currency": "EUR"
  }
}
```

#### User Interactions

- Period selector tabs: Today / Week / Month
- Revenue trend: daily bar chart
- Offer performance: sell-through percentage bar per offer
- Active orders list with status, quantity, price, pickup deadline
- Ratings: 5-star display + review count
- Payout balance: unsettled and last payout amount/date
- Pull-to-refresh; language selector button

#### Notes

- Order status color coding: CONFIRMED=blue, PROCESSING=orange, READY=green
- All monetary values formatted using `payoutBalance.currency`

---

## 9. Vendor Chain & Worker Management

---

### WorkerManagementSelectionScreen

**Role:** Vendor (VENDOR_ADMIN, CHAIN only)
**Purpose:** Select a chain location to manage its workers. Non-HQ users auto-select their own location.
**Navigates from:** VendorMainScreen
**Navigates to:** WorkerManagementScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get chain locations | GET | `/vendors/chain-locations` | — | `ChainLocation[]` |

#### User Interactions

- List of location cards (name, email, status, HQ badge)
- Tap location → WorkerManagementScreen for that location
- Non-HQ: auto-navigates to own location after load

---

### WorkerManagementScreen

**Role:** Vendor (VENDOR_ADMIN, CHAIN only)
**Purpose:** Create, activate, deactivate, and delete workers for a specific location.
**Navigates from:** WorkerManagementSelectionScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get location workers | GET | `/vendors/chain-locations/{locationId}/workers` | — | `Worker[]` |
| Create worker | POST | `/vendors/chain-locations/{locationId}/workers` | `{ username, email, password, phone? }` | `{ message: string, workerId?: number }` |
| Activate worker | POST | `/vendors/workers/{workerId}/activate` | `{}` | `{ message: string }` |
| Deactivate worker | POST | `/vendors/workers/{workerId}/deactivate` | `{}` | `{ message: string }` |
| Delete worker | DELETE | `/vendors/workers/{workerId}` | — | `{ message: string }` |

#### User Interactions

- Worker list: username, email, role, location ID, status badge (ACTIVE/INACTIVE)
- "Add Worker" button → modal with form (username, email, password min 8 chars, phone optional)
- Per worker: Activate/Deactivate toggle button; Delete button
- Confirmation alerts for all destructive/state-change actions

#### Notes

- HQ can manage workers at all locations; non-HQ can only manage their own
- Delete shows warning: "worker's offers will be invalidated"
- Password minimum 8 characters

---

### ChainLocationManagementScreen

**Role:** Vendor (VENDOR_ADMIN + Headquarters only)
**Purpose:** Add, edit, and remove chain locations. Includes address geocoding and worker management shortcuts.
**Navigates from:** VendorMainScreen
**Navigates to:** WorkerManagementScreen (per-location workers button)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get locations | GET | `/vendors/chain-locations` | — | `ChainLocation[]` |
| Add location | POST | `/vendors/chain-locations` | `{ locationName, email, phone, address, zipCode, latitude, longitude, country }` | `{ message: string }` |
| Update location | PUT | `/vendors/chain-locations/{id}` | Same as add | `{ message: string }` |
| Remove location | DELETE | `/vendors/chain-locations/{id}` | — | `{ message: string }` |

#### User Interactions

- Location list cards with: name, email, status, HQ badge
- "Add Location" button → modal with address form + auto-geocoding (1s debounce)
- Edit button (pencil icon) → edit modal (HQ cannot be edited)
- Remove button (trash icon) → confirmation → delete (HQ cannot be removed)
- Workers button (👥) → WorkerManagementScreen

#### Notes

- Auto-geocoding: triggers 1s after all address fields filled; coordinates required before submit
- Location removal invalidates all offers from that location

---

### UpgradeToChainScreen

**Role:** Vendor (VENDOR_ADMIN, UNIQUE only)
**Purpose:** Upgrade a single-location vendor to a chain. Current location becomes HQ.
**Navigates from:** VendorMainScreen
**Navigates to:** VendorMainScreen (on success, after `refreshUser`)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Upgrade to chain | POST | `/vendors/upgrade-to-chain` | `{ chainName: string }` | `{ message: string }` |

#### User Interactions

- Info card: "What is a Chain?" description
- Benefits card: 4 chain benefits listed
- Chain name input (required, 2–100 chars)
- "Current Location becomes HQ" info card
- "Upgrade to Chain" button → confirmation alert → submit

#### Notes

- Irreversible action (no downgrade in app)
- `refreshUser()` called after success to update vendor info

---

### BankingModelManagementScreen

**Role:** Vendor (VENDOR_ADMIN, CHAIN only)
**Purpose:** View current banking model and switch between SHARED and INDIVIDUAL. Only HQ can switch. Shows per-location payment account setup status in INDIVIDUAL mode.
**Navigates from:** VendorMainScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get banking info | GET | `/vendors/banking-info` | — | `{ bankingModel, chainName, totalLocations, locationsWithPaymentAccounts, headquartersLocationName, headquartersEmail }` |
| Switch banking model | POST | `/vendors/banking-model/switch` | `{ bankingModel: "SHARED" \| "INDIVIDUAL" }` | `{ message: string }` |
| Setup location payment | POST | `/vendors/chain-locations/{locationId}/payment-setup` | `{}` | `{ message: string }` |
| Get chain locations | GET | `/vendors/chain-locations` | — | `ChainLocation[]` |

#### User Interactions

- View current model (SHARED / INDIVIDUAL)
- Chain name and location count display
- Switch model card (HQ only): tap → confirmation alert → submit
  - Switching to INDIVIDUAL: warning that all active offers will be invalidated
- Location list (INDIVIDUAL mode): per-location payment account status + "Setup" button
- Non-HQ: read-only view with message to contact HQ

---

## 10. Vendor Finance — Stripe Connect

These screens are only visible to vendors using the **Stripe Connect (CONNECT)** payment model.

---

### PaymentSettingsScreen

**Role:** Vendor
**Purpose:** Central hub for payment setup. Shows status and routes to appropriate sub-screens based on payment model (CONNECT vs MoR).
**Navigates from:** VendorMainScreen
**Navigates to:** StripeOnboardingScreen, BalanceScreen, PayoutsListScreen, TransactionsScreen, AccountDetailsScreen, RequirementsScreen, BankAccountsScreen, MoRBalanceScreen, MoRTransactionsScreen, MoRBankDetailsScreen, MoRPayoutsScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get payment status | GET | `/vendors/payment/status` | — | `PaymentStatus` |
| Get Stripe balance | GET | `/vendors/stripe/balance` | — | `StripeBalance` |
| Get Stripe account status | GET | `/vendors/stripe/account-status` | — | `{ isReady: boolean, hasAccount: boolean, message: string }` |
| Get Stripe onboarding link | GET | `/vendors/stripe/onboarding-link` | — | `{ onboardingUrl: string }` |
| Get payment onboarding link | POST | `/vendors/payment/onboarding-link` | — | `{ onboardingUrl: string, message: string }` |
| Get MoR balance | GET | `/vendors/mor/balance` | — | `MoRBalance` |

#### User Interactions

- Status badge: "Not set up" / "Pending" / "Ready"
- "Set Up Payments" button (if not ready) → StripeOnboardingScreen (CONNECT) or MoRBankDetailsScreen (MoR)
- **CONNECT model buttons:** Balance, Payouts, Transactions, Account Details, Requirements, Bank Accounts
- **MoR model buttons:** MoR Balance, MoR Transactions, MoR Bank Details, MoR Payouts
- Pull-to-refresh

#### Notes

- Auto-detects payment model from `PaymentStatus.payoutModel` (`CONNECT` or `MOR`)
- Gracefully handles 403/404 as "not set up" state
- Shows current balance if account is ready

---

### BalanceScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Show Stripe Connect account balance (available and pending).
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get balance | GET | `/vendors/stripe/balance` | — | `{ available: [{ amount, currency }], pending: [{ amount, currency }] }` |

#### Notes

- Auto-refreshes every 30 seconds
- "Pending" note: "Available in 2 days"

---

### BankAccountsScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Manage bank accounts on the Stripe Connect account (set default, delete).
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (triggers add bank account callback)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get bank accounts | GET | `/vendors/stripe/bank-accounts` | — | `StripeBankAccount[]` |
| Set default | PUT | `/vendors/stripe/bank-accounts/{id}/default?currency={currency}` | — | — |
| Delete account | DELETE | `/vendors/stripe/bank-accounts/{id}` | — | — |

#### Notes

- Cannot delete the default account for a currency
- Shows bank name, last 4 digits, holder name, account status, country

---

### RequirementsScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Show Stripe verification requirements grouped by urgency. Allows triggering completion flow.
**Navigates from:** PaymentSettingsScreen, AccountDetailsScreen
**Navigates to:** (back via callback)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get requirements | GET | `/vendors/stripe/requirements` | — | `{ pastDue: string[], currentlyDue: string[], eventuallyDue: string[], pendingVerification: string[], currentDeadline?: string, disabledReason?: string }` |

#### User Interactions

- Groups: Past Due (red), Currently Due (orange), Eventually Due (blue), Pending Verification (hourglass)
- "Complete requirements" button if pastDue or currentlyDue items exist → triggers `onCompleteRequirements` callback
- Pull-to-refresh

---

### TransactionsScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Show all Stripe transactions (charges, payouts, refunds) grouped by date.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get transactions | GET | `/vendors/stripe/transactions?limit=50` | — | `StripeTransaction[]` |

#### Notes

- Sorted newest first (by Unix timestamp)
- Refunds shown in red (minus sign); charges in green (plus sign)
- Shows type icon, description, amount, fee, net, status

---

### PayoutsListScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** List Stripe payouts.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** PayoutDetailScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get payouts | GET | `/vendors/stripe/payouts?limit=20` | — | `StripePayout[]` |

#### Notes

- Status colors: green (paid), orange (pending), red (failed)
- Shows arrival date if pending; failure message if failed

---

### PayoutDetailScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Full detail view of a single Stripe payout.
**Navigates from:** PayoutsListScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get payout detail | GET | `/vendors/stripe/payouts/{payoutId}` | — | `StripePayout` |

#### Notes

- Shows: ID, amount, status, creation date, arrival date, method (standard/instant), destination bank account
- Shows failure code + message if failed

---

### AccountDetailsScreen

**Role:** Vendor (Stripe Connect)
**Purpose:** Display Stripe Connect account information and verification status.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** RequirementsScreen (via "Complete requirements" button)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get account details | GET | `/vendors/stripe/account` | — | `{ id, email, country, currency, businessType, businessName, chargesEnabled, payoutsEnabled, detailsSubmitted }` |

#### Notes

- Shows warning card if `chargesEnabled` or `payoutsEnabled` is false

---

### StripeOnboardingScreen

**Role:** Vendor
**Purpose:** WebView-based Stripe Connect onboarding. Handles return/refresh deep links to complete onboarding.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** PaymentSettingsScreen (on success or cancel)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get onboarding link | GET | `/vendors/stripe/onboarding-link` | — | `{ onboardingUrl: string }` |
| Handle Stripe return | POST | `/vendors/stripe/return` | — | `{ isReady: boolean, requiresAuth: boolean, message: string }` |
| Handle Stripe refresh | POST | `/vendors/stripe/refresh` | — | `{ onboardingUrl: string, message: string }` |

#### Notes

- WebView only allows navigation to `*.stripe.com` domains (security restriction)
- Deep links intercepted: `stillfresh://vendors/stripe/return` → call return endpoint
- Deep links intercepted: `stillfresh://vendors/stripe/refresh` → call refresh endpoint, reload WebView with new URL
- `isReady: true` → show success alert, navigate back
- `isReady: false` → show "pending" alert, allow retry

---

## 11. Vendor Finance — Merchant of Record (MoR)

These screens are only visible to vendors using the **MoR** payment model.

---

### MoRBalanceScreen

**Role:** Vendor (MoR)
**Purpose:** Display MoR account balance.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get MoR balance | GET | `/vendors/mor/balance` | — | `{ balance: number (cents), currency: string, hasBankDetails: boolean }` |

#### Notes

- Auto-refreshes every 30 seconds
- Shows warning if `hasBankDetails: false`

---

### MoRTransactionsScreen

**Role:** Vendor (MoR)
**Purpose:** Show all MoR transactions grouped by date.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (back only)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get transactions | GET | `/vendors/mor/transactions?limit=50` | — | `MoRTransaction[]` |

#### Notes

- Transaction types: `ORDER_PAYMENT` (+), `PAYOUT` (−), `ADJUSTMENT`, `REFUND`
- Sorted by `createdAt` (ISO 8601), newest first
- Grouped: Today / Yesterday / This Week / This Month / Older

---

### MoRBankDetailsScreen

**Role:** Vendor (MoR)
**Purpose:** Add/edit bank account details for MoR payouts.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** (back or `onSuccess` callback)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Submit bank details | POST | `/vendors/mor/bank-details` | `{ holderName, accountNumber, bankName, swiftCode?, iban?, payoutMethod: "BANK" \| "WISE" \| "OTHER" }` | 200 OK |

#### User Interactions

- Required: Holder Name, Account Number, Bank Name
- Optional: SWIFT code, IBAN
- Payout method selector: BANK (default), WISE, OTHER
- "Save" button; "Cancel" button

---

### MoRPayoutsScreen

**Role:** Vendor (MoR)
**Purpose:** View MoR payouts and request new payouts.
**Navigates from:** PaymentSettingsScreen
**Navigates to:** MoRBankDetailsScreen (if bank details not set up)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Get payouts | GET | `/vendors/mor/payouts` | — | `MoRPayout[]` |
| Get balance | GET | `/vendors/mor/balance` | — | `MoRBalance` |
| Request payout | POST | `/vendors/mor/request-payout` | `{ amount: number (cents), currency?: string, description?: string }` | `{ success: boolean, payoutId: string, message: string }` |

#### User Interactions

- Payouts list: amount, status, requested date, processed date (if complete), transaction reference
- "Request Payout" button → modal with amount input + optional description
- Modal: shows current balance for reference; validates amount > 0 and <= balance
- Shows warning if `hasBankDetails: false` → link to MoRBankDetailsScreen

#### Notes

- Status: PENDING (orange), PROCESSING (orange), COMPLETED (green), FAILED (red)
- Sorted by `requestedAt`, newest first

---

## 12. Customer Payments & Payment Methods

---

### PaymentMethodsScreen

**Role:** Customer
**Purpose:** View, set default, and delete saved payment methods (cards and bank accounts).
**Navigates from:** CustomerMainScreen (Profile → Payment Methods)
**Navigates to:** AddCardScreen, AddBankAccountScreen

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| List payment methods | GET | `/payment/payment-methods` | — | `CustomerPaymentMethod[]` |
| Set default | PUT | `/payment/payment-methods/{id}/default` | — | `CustomerPaymentMethod` |
| Delete method | DELETE | `/payment/payment-methods/{id}` | — | `{ success: boolean, message: string }` |

#### User Interactions

- List of cards and bank accounts with last-4 digits, expiry (cards), bank name (bank accounts)
- Default method shown with badge
- Per-method overflow menu: "Set as Default", "Delete"
- "Add Card" → AddCardScreen
- "Add Bank Account" → AddBankAccountScreen
- Pull-to-refresh

---

### AddCardScreen

**Role:** Customer
**Purpose:** Add a credit/debit card using Stripe's secure CardField component.
**Navigates from:** PaymentMethodsScreen
**Navigates to:** PaymentMethodsScreen (after save)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Register card | POST | `/payment/register-card` | `{ paymentMethodId: string }` | `{ customerId: string, message: string }` |

#### User Interactions

- Stripe `CardField` component (handles card number, expiry, CVC securely)
- "Set as default" toggle switch
- "Save Card" button → calls `stripe.createPaymentMethod()` → sends `paymentMethodId` to backend
- "Cancel" button

#### Notes

- `stripe.createPaymentMethod()` is called first (client-side); sends only the resulting `paymentMethodId` to backend
- Validates card completeness before submission
- Error messages mapped from Stripe error codes (declined, expired, invalid CVC, etc.)

---

### AddBankAccountScreen

**Role:** Customer
**Purpose:** Add a US bank account using Stripe's USBankAccount payment method type.
**Navigates from:** PaymentMethodsScreen
**Navigates to:** PaymentMethodsScreen (after save)

#### API Calls

| Action | Method | Endpoint | Request Body | Response Shape |
|--------|--------|----------|--------------|----------------|
| Register bank account | POST | `/payment/register-bank-account?bankAccountToken={token}` | — (token as query param) | `CustomerPaymentMethod` |

#### User Interactions

- Inputs: Account holder name, Account number, Routing number (9 digits), Account type (checking/savings)
- Optional: Account holder type (individual/company)
- "Link Account" button → `stripe.createPaymentMethod(USBankAccount)` → sends token to backend

#### Notes

- Only US bank accounts supported (Stripe limitation)
- Routing number: min 9 digits; Account number: min 4 digits
- Non-digit characters stripped automatically from numeric inputs

---

## 13. Complete API Reference

### Base URLs

| Environment | URL |
|------------|-----|
| Development | `http://localhost:8080` |
| Production | `https://api.stillfresh.com` |

> Note: Notification endpoints have `/api` prefix (e.g., `/api/notifications/...`). All other endpoints have no prefix.

### All Endpoints

#### Authentication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Email/password login |
| POST | `/auth/google-login` | Google OAuth login/signup |
| POST | `/auth/logout` | Logout (revoke tokens) |
| POST | `/auth/forgot-password` | Request password reset (unauthenticated) |
| GET | `/auth/reset-password?token={token}` | Confirm password reset token |
| POST | `/auth/change-password` | Change password (authenticated) |

#### Users / Customers

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/users/register` | Register customer account |
| GET | `/users` | Get current user full profile |
| PUT | `/users` | Update user profile fields |
| DELETE | `/users/delete` | Delete customer account |
| GET | `/users/favorites` | List customer favorites |
| POST | `/users/favorites/{offerId}` | Add offer to favorites |
| DELETE | `/users/favorites/{offerId}` | Remove offer from favorites |
| GET | `/customers/search-nearby` | Search nearby offers by location |
| GET | `/customers/payment-methods` | List customer payment methods |
| PUT | `/customers/payment-methods/{id}/default` | Set default payment method |
| DELETE | `/customers/payment-methods/{id}` | Delete payment method |

#### Vendors

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vendors/apply` | Submit vendor application |
| PUT | `/vendors/update-profile` | Update vendor profile |
| GET | `/vendors/onboarding/status` | Get onboarding status |
| POST | `/vendors/onboarding/set-vendor-type` | Set vendor type (CHAIN/UNIQUE) |
| POST | `/vendors/onboarding/add-headquarters` | Add HQ location (CHAIN) |
| POST | `/vendors/onboarding/set-banking-model` | Set banking model |
| POST | `/vendors/onboarding/setup-payment-account` | Initiate payment account setup |
| POST | `/vendors/onboarding/complete` | Complete onboarding |
| GET | `/vendors/all-offers` | Get all vendor offers |
| GET | `/vendors/active-offers` | Get all active offers (public) |
| POST | `/vendors/offer-create` | Create new offer |
| POST | `/vendors/update-offer/{offerId}` | Update/reactivate offer |
| POST | `/vendors/invalidate-offer/{offerId}` | Invalidate an active offer |
| DELETE | `/vendors/delete` | Delete vendor account |
| POST | `/vendors/upgrade-to-chain` | Upgrade unique vendor to chain |
| GET | `/vendors/banking-info` | Get chain banking model info |
| POST | `/vendors/banking-model/switch` | Switch banking model |
| GET | `/vendors/chain-locations` | List chain locations |
| POST | `/vendors/chain-locations` | Add chain location |
| PUT | `/vendors/chain-locations/{id}` | Update chain location |
| DELETE | `/vendors/chain-locations/{id}` | Remove chain location |
| POST | `/vendors/chain-locations/{id}/payment-setup` | Setup location payment account |
| GET | `/vendors/chain-locations/{id}/workers` | List workers at location |
| POST | `/vendors/chain-locations/{id}/workers` | Create worker |
| POST | `/vendors/workers/{id}/activate` | Activate worker |
| POST | `/vendors/workers/{id}/deactivate` | Deactivate worker |
| DELETE | `/vendors/workers/{id}` | Delete worker |

#### Vendor Ratings

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vendors/ratings/submit` | Submit vendor rating |
| GET | `/vendors/ratings/vendor/{vendorId}` | Get ratings for vendor |
| GET | `/vendors/ratings/vendor/{vendorId}/summary` | Get rating summary |
| GET | `/vendors/ratings/vendor/{vendorId}/has-rated` | Check if current user has rated |
| GET | `/vendors/ratings/my-ratings` | Get current user's submitted ratings |

#### Vendor Stripe Connect Finance

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/vendors/payment/status` | Get payment account status |
| POST | `/vendors/payment/onboarding-link` | Get payment onboarding link |
| GET | `/vendors/stripe/account-status` | Get Stripe account readiness |
| GET | `/vendors/stripe/onboarding-link` | Get Stripe Connect onboarding URL |
| POST | `/vendors/stripe/return` | Handle Stripe return deep link |
| POST | `/vendors/stripe/refresh` | Handle Stripe refresh deep link |
| GET | `/vendors/stripe/account` | Get Stripe account details |
| GET | `/vendors/stripe/balance` | Get Stripe account balance |
| GET | `/vendors/stripe/requirements` | Get verification requirements |
| GET | `/vendors/stripe/transactions?limit=50` | Get transactions |
| GET | `/vendors/stripe/payouts?limit=20` | List payouts |
| GET | `/vendors/stripe/payouts/{id}` | Get payout details |
| GET | `/vendors/stripe/bank-accounts` | List bank accounts |
| PUT | `/vendors/stripe/bank-accounts/{id}/default?currency=` | Set default bank account |
| DELETE | `/vendors/stripe/bank-accounts/{id}` | Delete bank account |
| GET | `/vendors/stripe/login-link` | Get Stripe Express Dashboard link |

#### Vendor MoR Finance

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/vendors/mor/balance` | Get MoR balance |
| GET | `/vendors/mor/transactions?limit=50` | Get MoR transactions |
| GET | `/vendors/mor/payouts` | List MoR payouts |
| POST | `/vendors/mor/request-payout` | Request MoR payout |
| GET | `/vendors/mor/bank-details` | Get saved bank details |
| POST | `/vendors/mor/bank-details` | Submit bank details |

#### Offers (Public / Customer)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/offers` | List all offers |
| GET | `/offers/{offerId}` | Get single offer details |
| GET | `/offers/nearby` | Search nearby offers (query params: latitude, longitude, range, sort) |
| GET | `/offers/categories` | Get offer categories |

#### Orders

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/orders/place-order` | Place a new order |
| GET | `/orders` | List user's orders (paginated: `?page=&size=`) |
| GET | `/orders/{orderId}` | Get single order |
| PUT | `/orders/{orderId}/confirm-pickup` | Confirm customer pickup (triggers payment capture) |
| PUT | `/orders/{orderId}/cancel` | Cancel order |
| PUT | `/orders/{orderId}/reject` | Reject order (vendor) |
| PUT | `/orders/{orderId}/status` | Update order status (vendor) |

#### Payments (Customer)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payment/register-card` | Register card via Stripe paymentMethodId |
| POST | `/payment/register-bank-account?bankAccountToken=` | Register bank account |
| GET | `/payment/payment-methods` | List payment methods |
| GET | `/payment/payment-methods/{id}` | Get single payment method |
| PUT | `/payment/payment-methods/{id}/default` | Set default payment method |
| DELETE | `/payment/payment-methods/{id}` | Delete payment method |
| POST | `/payment/charge` | Process payment |
| POST | `/payment/capture/{paymentIntentId}` | Capture payment intent |
| POST | `/payment/cancel/{paymentIntentId}` | Cancel payment intent |

#### Analytics

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/vendors/{vendorId}/dashboard?period={period}` | Get vendor analytics dashboard |

#### Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/notifications/fcm-token/register` | Register FCM device token |
| DELETE | `/api/notifications/fcm-token` | Remove FCM token |
| GET | `/api/notifications/user` | Get user's notifications |
| POST | `/api/notifications/mark-read/{id}` | Mark notification as read |
| POST | `/api/notifications/mark-all-read` | Mark all notifications as read |
| DELETE | `/api/notifications/{id}` | Delete notification |
| GET | `/api/notifications/preferences` | Get notification preferences |
| POST | `/api/notifications/preferences` | Update notification preferences |
| POST | `/api/notifications/test` | Send test push notification |

#### Categories & Images

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/categories?language={lang}` | Get offer categories |
| POST | `/images/upload` | Upload image (multipart form) → `{ imageUrl: string }` |

---

## 14. Data Models

### User

```typescript
{
  id: number | string
  email: string
  username?: string
  firstName: string
  lastName: string
  role: "USER" | "VENDOR" | "VENDOR_ADMIN"
  profileCompleted?: boolean
  phoneNumber?: string
  address?: string
  country?: string
  birthday?: string           // "YYYY-MM-DD"
  dietaryPreference?: string
  vendor?: VendorInfo
}
```

### VendorInfo (nested in User)

```typescript
{
  id: number
  isHeadquarters: boolean
  isChainLocation: boolean
  chainName?: string
}
```

### Offer

```typescript
{
  id: number | string
  name: string
  description: string
  price: number
  originalPrice: number
  quantityAvailable: number    // also: availableQuantity, quantity
  pickupStartTime: string      // "HH:MM:SS"
  pickupEndTime: string        // "HH:MM:SS"
  pickupDate: string           // "YYYY-MM-DD"
  imageUrl?: string
  category?: string
  dietaryInfo?: string
  allergenInfo?: string
  vendorId?: number
  vendorName?: string
  vendorAddress?: string
  latitude?: number
  longitude?: number
  greyedOut?: boolean          // expired or sold out
  pickupDaySlot?: string       // "TODAY" | "TOMORROW" | etc. — set by backend
  pickupMealSlot?: string      // "LUNCH" | "BREAKFAST" | "DINNER" — set by backend
  status?: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "INACTIVE"
}
```

### Order

```typescript
{
  id: number | string
  offerId: number | string
  offer?: Offer
  quantity: number
  totalPrice: number
  currency: string
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "READY" | "COMPLETED" | "CANCELLED" | "EXPIRED"
  paymentIntentId?: string
  createdAt: string
  pickupBy?: string
}
```

### CustomerPaymentMethod

```typescript
{
  id: string
  type: "card" | "bank_account"
  isDefault: boolean
  // Card-specific:
  last4?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  // Bank account-specific:
  bankName?: string
  accountLast4?: string
}
```

### OnboardingStatus (enum)

```
PENDING_VERIFICATION | VERIFIED | TYPE_SELECTED | HEADQUARTERS_ADDED |
BANKING_SETUP | PAYMENT_CONFIGURED | COMPLETED
```

### VendorType (enum)

```
CHAIN | UNIQUE
```

### BankingModel (enum)

```
SHARED | INDIVIDUAL
```

### NotificationPreferences

```typescript
{
  pushEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  enabledTypes: string[]   // subset of NOTIFICATION_TYPES
}
```

### Notification

```typescript
{
  id: string
  type: string             // one of NOTIFICATION_TYPES
  title: string
  message: string
  isRead: boolean
  createdAt: string        // ISO 8601
}
```

### ChainLocation

```typescript
{
  id: number
  locationName: string
  email: string
  phone?: string
  address?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  country?: string
  status: "ACTIVE" | "INACTIVE"
  isHeadquarters: boolean
}
```

### Worker

```typescript
{
  id: number
  username: string
  email: string
  role: "VENDOR"
  locationId: number
  status: "ACTIVE" | "INACTIVE"
}
```

### StripeBalance

```typescript
{
  available: [{ amount: number, currency: string }]
  pending: [{ amount: number, currency: string }]
}
```

### StripePayout

```typescript
{
  id: string
  amount: number           // cents
  currency: string
  status: "paid" | "pending" | "failed"
  created: number          // Unix timestamp
  arrivalDate?: number     // Unix timestamp
  method: "standard" | "instant"
  failureCode?: string
  failureMessage?: string
  destination?: string
}
```

### MoRBalance

```typescript
{
  balance: number          // cents
  currency: string
  hasBankDetails: boolean
}
```

### MoRTransaction

```typescript
{
  id: string
  type: "ORDER_PAYMENT" | "PAYOUT" | "ADJUSTMENT" | "REFUND"
  description: string
  amount: number           // cents; positive = income, negative = outflow
  currency: string
  createdAt: string        // ISO 8601
}
```

### MoRPayout

```typescript
{
  id: string
  amount: number           // cents
  currency: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  requestedAt: string      // ISO 8601
  processedAt?: string     // ISO 8601
  transactionReference?: string
}
```

### VendorRatingSummary

```typescript
{
  averageRating: number
  totalRatings: number
  averageCollectionProcessRating?: number
  averageFoodQualityRating?: number
  averageValueRating?: number
}
```

### Category

```typescript
{
  id: string | number
  name: string
  key: string
  language?: string
}
```
