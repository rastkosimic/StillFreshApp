# StillFresh GUI — Reference

## Mockup index

| File | Screens covered |
|------|-----------------|
| `design_mockups/CustomerHomeScreen.html` | Discover home, location header, category pills, offer card rails, LIVE badge, missed section |
| `design_mockups/offer_details_screen.html` | Hero image, sticky header, quantity banner, vendor overlay, map, reserve CTA |
| `design_mockups/vendor_dashboard_offer_management.html` | Dashboard metrics, offer list, filters, create/edit offer forms |
| `design_mockups/vendor_analytics.html` | Period selector, charts, performance cards |
| `design_mockups/vendor_onboarding_flow.html` | Multi-step onboarding, progress bar, type selection |
| `design_mockups/vendor_edit_profile.html` | Profile form groups, image picker |
| `design_mockups/vendor_reset_password.html` | Auth form layout |

## Color scale (primary)

| Step | Hex | Typical use |
|------|-----|-------------|
| 50 | `#EAF2EA` | Icon circle backgrounds |
| 100 | `#C9E0CA` | Image placeholder bg |
| 200 | `#A3C9A5` | Empty-state icons |
| 400 | `#5E9B61` | Fallback icon tint |
| 500/DEFAULT | `#2C5F2E` | Brand, CTAs, prices |
| 600–900 | darker greens | Rare; hover/pressed if needed |

## Color scale (accent)

| Step | Hex | Typical use |
|------|-----|-------------|
| DEFAULT | `#B8D94A` | LIVE badge background |
| 600 | `#86A12D` | Accent text on light bg (mockups) |

## Typography quick reference

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Brand | 30–36 | 700 | primary |
| Screen title | 28 | 700 | text-primary |
| Section title | 16 | 700 | text-primary |
| Body | 15–16 | 400 | text-primary |
| Label / caption | 12–13 | 500–600 | text-secondary |
| Button | 16 | 600 | white or text-primary |
| Tab label | 10–12 | 500 | secondary / primary when active |

## Spacing scale

| Token | px | Common use |
|-------|-----|------------|
| 1 | 4 | Tight gaps |
| 2 | 8 | Icon gaps, badge padding |
| 3 | 12 | Card internal gaps |
| 4 | 16 | Screen horizontal padding |
| 6 | 24 | Auth horizontal padding |
| 8 | 32 | Section spacing |

## Component dimensions

| Element | Size |
|---------|------|
| Offer card width | 175px |
| Offer card image height | 112px (h-28) |
| Vendor avatar on card | 32×32, overlaps -16px |
| Icon button (header) | 36×36 |
| Back button | `BackButton` — 36×36 circle, `bg-background`, `chevron-back` 20px |
| Location icon circle | 28×28 (w-7 h-7) |
| Hero image height | 260–280px |
| Metric card value | 22px bold |
| List row icon | 20px |
| Tab bar icon | ~22–26px |

## Shadow recipe (copy-paste for style prop)

```ts
// Standard card
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
}

// Offer card (slightly stronger)
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.09,
  shadowRadius: 3,
  elevation: 2,
}

// Floating panel (range slider)
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
}
```

## Implemented reference screens

| Screen | Path | Patterns demonstrated |
|--------|------|----------------------|
| Customer home | `src/screens/customer/CustomerHomeScreen.tsx` | Location header, pills, sections, OfferCard rail |
| Offer details | `src/screens/customer/OfferDetailsScreen.tsx` | Hero, scrims, sticky header, map |
| Login | `src/screens/auth/LoginScreen.tsx` | Forms, primary/secondary buttons |
| Role selection | `src/screens/auth/RoleSelectionScreen.tsx` | Selection cards |
| Offer card | `src/components/OfferCard.tsx` | Canonical card component |
| Back button | `src/components/BackButton.tsx` | Uniform header back control (customer & vendor) |
| Vendor dashboard | `src/screens/vendor/VendorDashboardScreen.tsx` | Metrics, list rows, section labels |
| Vendor onboarding | `src/screens/vendor/onboarding/VendorTypeSelectionScreen.tsx` | Progress bar, type cards |

## Tab bar configuration

```ts
tabBarActiveTintColor: colors.primary.DEFAULT,
tabBarInactiveTintColor: colors.text.secondary,
tabBarStyle: {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
},
```

## Quantity badge colors (app-wide standard)

Always use `getQuantityLeftBadgeStyle(offer.quantityAvailable)` from `src/utils/getQuantityLeftBadgeStyle.ts`
for every "X left" pill that has a colored background. **Never** inline the color logic manually.

| Stock | Style |
|-------|-------|
| `greyed` / missed | Grey (`text.secondary` bg), white text — handled at call site |
| ≤ 3 left | Red (`error` bg), white text |
| 4–5 left | Yellow (`warning` bg), white text |
| > 5 left | Green (`primary.DEFAULT` bg), white text |

```ts
import { getQuantityLeftBadgeStyle } from '@/utils/getQuantityLeftBadgeStyle';

const badge = getQuantityLeftBadgeStyle(offer.quantityAvailable);
// badge.backgroundColor, badge.textColor, badge.borderColor?, badge.borderWidth?
```

## Order status text colors (vendor)

| Status | Color |
|--------|-------|
| CONFIRMED | Blue — use a dedicated token if added; currently inline in screens |
| PROCESSING | `warning` |
| READY | `success` / `primary` |

## Keyboard avoidance patterns

### Full-screen form shell

```tsx
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

<KeyboardAvoidingView
  className="flex-1 bg-background"
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <ScrollView
    contentContainerStyle={{ flexGrow: 1 }}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {/* content */}
  </ScrollView>
</KeyboardAvoidingView>
```

### Bottom-sheet editor shell (profile field modal)

```tsx
import { KeyboardAvoidingView, Modal, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <KeyboardAvoidingView
    className="flex-1"
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    <View className="flex-1 justify-end bg-black/40">
      <View
        className="bg-surface rounded-t-2xl px-6 pt-5"
        style={{ paddingBottom: insets.bottom + 20 }}
      >
        <TextInput … />
        {/* primary CTA must be inside this sheet */}
      </View>
    </View>
  </KeyboardAvoidingView>
</Modal>
```

### Screens that already follow the pattern

| Pattern | Examples |
|---------|----------|
| Full-screen `KeyboardAvoidingView` | `LoginScreen`, `CustomerRegisterScreen`, `CreateOfferScreen`, `VendorEditProfileScreen` |
| Bottom-sheet with keyboard lift | `ProfileFieldEditModal` |

## Notification UI patterns

### Inbox row (`NotificationScreen`)

```
[icon circle 40×40] [title (semibold if unread)] [unread dot w-2 h-2 bg-primary rounded-full]
                    [message 2-line text-xs text-secondary]
                    [relative time text-xs text-secondary]
```

- **Unread row background**: `colors.primary[50]` (`#EAF2EA`)
- **Read row background**: `colors.surface` (`#FFFFFF`)
- **Unread dot**: `w-2 h-2 rounded-full bg-primary`, aligned `mt-1.5 ml-2`
- **Divider**: `border-b border-border`
- **Swipe-to-delete**: right-side `bg-error` panel with `trash-outline` icon (Ionicons, white)
- **Pull-to-refresh**: `tintColor: colors.primary.DEFAULT`

### Notification type → icon color

| Type group | Background | Icon | Tint |
|---|---|---|---|
| ORDER_CONFIRMED, ORDER_RECEIVED | `primary[100]` `#C9E0CA` | checkmark-circle / receipt-outline | `primary` green |
| ORDER_CANCELLED, PAYMENT_FAILED | `#FEECEC` | close-circle / card-outline | `error` red |
| ORDER_EXPIRED, ORDER_PICKUP_REMINDER | `#FFF4E5` | time-outline / alarm-outline | `warning` amber |
| PAYMENT_SUCCESSFUL, BANK_TRANSFER_CONFIRMED | `primary[100]` | card / checkmark-circle | `primary` green |
| BANK_TRANSFER_INITIATED, BANKING_MODEL_CHANGED | `primary[50]` | swap-horizontal-outline / settings-outline | `primary` green |
| SYSTEM_ALERT | `#FFF4E5` | alert-circle-outline | `warning` amber |

### Unread badge on bell icon (CustomerHome header)

```tsx
<TouchableOpacity className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
  <Ionicons name="notifications-outline" size={18} color={colors.text.primary} />
  {unreadCount > 0 && (
    <View
      className="absolute top-0 right-0 rounded-full items-center justify-center"
      style={{ minWidth: 16, height: 16, backgroundColor: colors.error }}
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  )}
</TouchableOpacity>
```

### Notification preferences screen

- Layout: `bg-background`, `ScrollView`, `SectionLabel` (uppercase 12px) per group
- Master push toggle: full-width row in `bg-surface rounded-[14px] border border-border` card
- Per-type toggles: same card, stacked rows with `border-b border-border` dividers
- When master push is OFF: type section `opacity-50` + `Switch disabled`
- `Switch` colors: `trackColor: { false: colors.border, true: colors.primary.DEFAULT }`, `thumbColor: colors.surface`
- Auto-save: debounce 500ms on every toggle change; `Alert` on error

## Anti-patterns (do not repeat)

- Hardcoded Belgrade coordinates in UI copy (use location from store)
- `StyleSheet.create()` for new screens
- Hex colors directly in component files
- Magic `paddingTop: 56` instead of `insets.top`
- Filled background badges for vendor order status (use text-only)
- Computing pickup slots client-side (display backend fields)
- Bottom-sheet `Modal` with `TextInput` and no `KeyboardAvoidingView` (keyboard covers the field)
- iOS system blue (`#007AFF`) for links — use `primary` green instead
- Raw `arrow-back`, Feather `chevron-left`, or text-only header back links — use `BackButton`
