---
name: stillfresh-gui-design
description: >-
  StillFresh mobile app GUI design system — colors, typography, spacing, components,
  and screen patterns for customer and vendor flows. Use when building or redesigning
  screens, components, or UI in this React Native / NativeWind codebase; when matching
  design_mockups; or when the user asks about visual style, layout, or design principles.
---

# StillFresh GUI Design

Apply this skill before implementing or changing any screen UI. Functional behavior lives in `spec/APP_SPEC.md`; this skill covers **how it should look and feel**.

## Design intent

StillFresh is a food-rescue marketplace (Too Good To Go model). The UI should feel:

- **Fresh & trustworthy** — forest green brand, warm off-white canvas, food imagery forward
- **Light & approachable** — single light theme; no dark mode
- **Scannable** — horizontal card rails, pill filters, clear price hierarchy
- **Mobile-native** — safe-area aware, thumb-friendly tap targets, subtle shadows, keyboard-safe forms

Reference mockups: `design_mockups/*.html`. When in doubt, match those files and existing screens in `src/screens/`.

## Non-negotiables

1. **NativeWind only** — Tailwind `className` strings; no `StyleSheet.create()` in new code
2. **No hardcoded colors in components** — use Tailwind tokens (`bg-primary`, `text-text-secondary`) or import from `src/theme/colors.ts` when programmatic access is required (maps, charts, shadows)
3. **No hardcoded user-facing strings** — i18n keys via `useTranslation()`
4. **Safe areas** — `useSafeAreaInsets()` for top/bottom edge padding; never magic numbers like `paddingTop: 56`
5. **Universal screen sizes** — flex layouts; test mentally at 360×640, 390×844, 430×932 dp
6. **Keyboard must not cover inputs** — when a field is focused, the active `TextInput` and its Save/Submit button must stay fully visible above the keyboard on all platforms. Never ship a form or edit sheet where typing hides the field.

## Keyboard avoidance

**Rule:** The focused input and the primary action below it (Save, Continue, etc.) must remain visible while the keyboard is open. If the layout cannot fit, scroll or lift the container — do not let the keyboard overlay the field.

### Full-screen forms (login, register, create offer)

Wrap the screen in `KeyboardAvoidingView` + `ScrollView`:

```tsx
<KeyboardAvoidingView
  className="flex-1 bg-background"
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <ScrollView
    contentContainerStyle={{ flexGrow: 1 }}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {/* fields + CTA */}
  </ScrollView>
</KeyboardAvoidingView>
```

Reference: `LoginScreen`, `CreateOfferScreen`, `VendorRegisterScreen`.

### Bottom-sheet / modal editors (profile field edit, etc.)

Any `Modal` with a `TextInput` anchored to the bottom **must** lift with the keyboard so the focused field and Save button stay visible. `KeyboardAvoidingView` alone is **not reliable** for bottom-anchored sheets on Android — use keyboard height + `ScrollView`:

```tsx
const [keyboardHeight, setKeyboardHeight] = useState(0);

useEffect(() => {
  if (!visible) {
    setKeyboardHeight(0);
    return;
  }
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  const showListener = Keyboard.addListener(showEvent, (e) => {
    setKeyboardHeight(e.endCoordinates.height);
  });
  const hideListener = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
  return () => { showListener.remove(); hideListener.remove(); };
}, [visible]);

<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View className="flex-1 justify-end bg-black/40">
    <Pressable className="flex-1" onPress={onClose} />
    <View style={{ marginBottom: keyboardHeight, maxHeight: SCREEN_HEIGHT * 0.85 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          className="bg-surface rounded-t-2xl px-6 pt-5"
          style={{ paddingBottom: keyboardHeight > 0 ? 12 : 16 }}
        >
          <TextInput autoFocus … />
          {/* Save + Cancel — must stay inside this sheet */}
        </View>
      </ScrollView>
    </View>
  </View>
</Modal>
```

Reference: `ProfileFieldEditModal`.

**Bottom spacing rule:** Never put `paddingBottom: insets.bottom + N` on the `ScrollView` `contentContainerStyle` or outside the white sheet — it creates a visible gap below Cancel and, when the keyboard is open, a dead zone between the sheet and keyboard. Use **12px** bottom padding inside the sheet when the keyboard is open, **16px** when closed. Lift with `marginBottom: keyboardHeight` only; do not stack safe-area inset on top of keyboard height.

**Anti-pattern (never do this):** bottom sheet with outer `contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}`, or `KeyboardAvoidingView` without keyboard-height lift — gap under the sheet and/or keyboard covering inputs.

### Additional rules

- Set `keyboardShouldPersistTaps="handled"` on any `ScrollView` that contains tappable fields or buttons
- Use correct `keyboardType` (`email-address`, `phone-pad`, `decimal-pad`, etc.) — reduces layout jumps
- For multi-field modals, keep Save button inside the lifted sheet (not fixed to screen bottom outside the avoiding view)
- Test on a small Android device/emulator — Android `height` behavior is required; iOS alone is not sufficient

### Keyboard checklist (add to screen QA)

- [ ] Focus every `TextInput` on the screen — field stays visible while typing
- [ ] Save/Submit button remains tappable without dismissing keyboard first
- [ ] Bottom-sheet editors lift fully above keyboard on iOS and Android — no gap between sheet bottom and keyboard top
- [ ] Sheet ends tight below Cancel (12–16px inner padding only; no outer safe-area padding below the sheet)
- [ ] Dismissing keyboard restores original layout (no stuck padding)

## Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| `primary` | `#2C5F2E` | CTAs, active tabs/pills, discount prices, brand wordmark |
| `primary-50`…`900` | scale | Icon circle backgrounds, image placeholders |
| `accent` | `#B8D94A` | "LIVE" / urgency highlights (lime, not CTA green) |
| `background` | `#F4F4F2` | Screen canvas |
| `surface` | `#FFFFFF` | Cards, inputs, tab bar, headers |
| `text-primary` | `#1A1A1A` | Headings, body |
| `text-secondary` | `#757575` | Labels, meta, inactive icons |
| `border` | `#E5E5E5` | Dividers, input borders, inactive pill borders |
| `error` | `#E53935` | Errors, "collect now" urgency, favorites filled |
| `warning` / `rating` | `#F5A623` | Stars, warnings |
| `success` | `#2C5F2E` | Positive trends (same as primary) |

Source of truth: `tailwind.config.js` ↔ `src/theme/colors.ts`.

## Typography

- **Font**: system default (`fontFamily.sans: System`)
- **Scale** (Tailwind classes): `text-xs`(12) · `text-sm`(14) · `text-base`(16) · `text-lg`(18) · `text-xl`(20) · `text-2xl`(24) · `text-3xl`(30) · `text-4xl`(36)
- **Weights**: body `font-normal` · labels `font-medium`/`font-semibold` · titles `font-bold`/`font-extrabold`
- **Hierarchy patterns**:
  - Brand wordmark: `text-3xl`/`text-4xl font-bold text-primary`
  - Screen title (vendor): 28px bold (`text-[28px]` or inline style from theme)
  - Section title: `text-base font-bold text-text-primary`
  - Card vendor line: `text-xs text-text-secondary`
  - Card title: `text-sm font-bold`
  - Meta / pickup window: `text-xs text-text-secondary`
  - Discount price: `text-base font-extrabold text-primary`
  - Strikethrough original: `text-xs text-text-secondary line-through`

## Spacing & radius

- **Base unit**: 4px (Tailwind `1` = 4px)
- **Screen padding**: customer `px-4` (16) · auth/onboarding `px-6` (24) · vendor headers ~20px
- **Card gap** in horizontal scrolls: 12px
- **Border radius**:
  - Cards / panels: `rounded-[14px]` or `rounded-2xl` (14–16px)
  - Buttons / inputs: `rounded-xl` (12px)
  - Pills / badges: `rounded-full`
  - Icon buttons: `rounded-full` at 36×36 (`w-9 h-9`)

## Shadows & elevation

Subtle only — cards float slightly above background:

```
shadowColor: '#000', shadowOffset: {0,1}, shadowOpacity: 0.06–0.09, shadowRadius: 3, elevation: 2
```

Offer cards use slightly stronger shadow (`shadowOpacity: 0.09`). Avoid heavy drop shadows.

## Interaction

| Pattern | Value |
|---------|-------|
| `activeOpacity` | 0.7 (list rows) · 0.8 (buttons, cards) |
| `hitSlop` | 8 on icon-only buttons |
| Pull-to-refresh tint | `colors.primary.DEFAULT` |
| Disabled / missed offers | `opacity: 0.5`, no `onPress`, `activeOpacity: 1` |
| Loading | `ActivityIndicator` with primary color |

## Iconography

| Context | Library | Style |
|---------|---------|-------|
| Customer flows | `@expo/vector-icons/Ionicons` | Outline when inactive, filled when active |
| Vendor flows | `@expo/vector-icons/Feather` | 20px in list rows, 16px chevrons (not for back navigation — use `BackButton`) |
| Section headers (customer) | Emoji prefix | e.g. ⚡ collect now, 🌤️ lunch |
| Icon-in-circle | `w-7 h-7` or `w-9 h-9` | `bg-primary-50` + primary icon, or `bg-surface border border-border` |

## Core components

### Offer card (`OfferCard`)

- Fixed width **175px**, `rounded-[14px]`, `bg-surface`
- Image area **h-28** (`112px`), `bg-primary-100` fallback
- **Overlapping vendor avatar**: 32×32 circle, `bottom: -16`, white 2px border
- Top-left badge: use `getQuantityLeftBadgeStyle(offer.quantityAvailable)` for stock-tier colors (red ≤3, yellow cream 4–5, green >5); grey (`text.secondary`) when missed/greyed
- Top-right rating: white pill + star in `rating` color
- Body: vendor name → offer name → meta (`pickup · distance`) → price row + heart
- Greyed variant: 50% opacity, no favorite toggle

### Category / filter pills

```
Active:   bg-primary + text-white (no border)
Inactive: bg-surface border border-border + text-text-primary
Shape:    rounded-full px-4 py-1.5, text-sm font-semibold
```

### Section header (customer home pattern)

```
[emoji] [title bold] [count pill bg-border] [optional LIVE badge bg-accent]
                                                    [See all text-primary semibold →]
```

- Count pill: `bg-border rounded-full px-2 py-0.5 text-xs font-semibold text-text-secondary`
- LIVE badge: `bg-accent rounded-full` + `text-xs font-extrabold text-text-primary`

### Primary / secondary buttons

```tsx
// Primary CTA
<TouchableOpacity className="bg-primary rounded-xl py-4 items-center" activeOpacity={0.8}>
  <Text className="text-white font-semibold text-base">…</Text>
</TouchableOpacity>

// Secondary / outline (e.g. Google sign-in)
<TouchableOpacity className="bg-surface border border-border rounded-xl py-4 items-center" activeOpacity={0.8}>

// Text link
<Text className="text-primary text-sm font-semibold">…</Text>
```

### Form inputs

```tsx
<TextInput
  className="bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-base"
  // error state: border-error
/>
// Label above: text-sm font-medium text-text-primary mb-1
// Error below: text-error text-xs mt-1
```

### Hero image (offer details)

- Height ~260–280px, full-bleed `cover` image
- Top scrim: `rgba(0,0,0,0.28)` for button legibility
- Bottom scrim: `rgba(0,0,0,0.45)` for vendor name overlay
- Back / share / favorite on hero: use `BackButton variant="overlay"` and matching 36×36 white circles `rgba(255,255,255,0.82)` for sibling actions
- Sticky header appears on scroll: white `surface` + bottom border

### Metric card (vendor dashboard)

- 2-column grid, gap 10px
- `bg-surface rounded-[14px] p-3.5` + subtle shadow
- Label: 12px secondary · Value: 22px bold primary
- **Primary earnings metric** (`totalVendorEarningsCents`): value in `text-primary` / `colors.primary.DEFAULT` — never label gross sales as vendor profit
- **Secondary financial metrics**: platform fee (`totalPlatformFeeCents`), optional gross sales (`totalGrossRevenueCents`) — always format with `formatCurrency(cents, currency)`
- Deprecated API field `totalRevenue` / `revenue` is gross sales in major units — do not use for vendor-facing earnings labels

### Financial breakdown row (vendor analytics — completed orders)

- Row in `list-card` style: order id left, **net earnings** right in `text-primary` bold
- Meta line: platform fee label + amount, optional `feePercentApplied` as “Platform fee (X%)”, settled date in `text-xs text-text-secondary`
- Active orders: status text-only colored via `orderStatusColor()`; price via `formatOrderAmount()` (major units)

### Section unavailable (graceful degradation)

When a dashboard section is `null` from the API, show a single card with centered `text-sm text-text-secondary`: i18n `analytics.sectionUnavailable` — not a full-screen error.

### List row (vendor settings pattern)

- `bg-surface`, row padding 12×16, hairline `border-b` (`#F2F2F7`)
- Left: Feather icon (secondary) · center: 15px label · right: chevron + optional red badge

### Section label (vendor)

- Uppercase, 12px, `letterSpacing: 0.5`, `text-text-secondary font-semibold`, margin 20/6/16

### Selection cards (auth role, onboarding type)

- Selected: `border-2 border-primary` or filled primary icon circle
- Unselected: `border border-border`, `bg-primary-50` icon circle
- Container: `bg-surface rounded-2xl p-6`

### Empty states

- Large muted icon (`leaf-outline`, 56px, `primary-200`)
- Title: `text-base font-semibold text-center`
- Description: `text-sm text-text-secondary text-center`

## Customer vs vendor personality

| Aspect | Customer | Vendor |
|--------|----------|--------|
| Styling | Prefer NativeWind classes | Mix of classes + `colors` inline (legacy OK, new code → NativeWind) |
| Layout | Horizontal card rails, discovery sections | Dashboard metrics, grouped list rows |
| Headers | Inline location row, no nav bar | Large title + date + profile avatar |
| Icons | Ionicons | Feather |
| Tone | Playful (emoji sections, map/notif chips) | Utilitarian (settings-list, analytics) |

Both share the same color tokens, tab bar styling, and form patterns.

## Navigation chrome

- **Tabs**: `headerShown: false`; custom per-screen headers
- **Tab bar**: `bg-surface`, `border-t border-border`, active `primary`, inactive `text-secondary`
- **Customer tabs**: Discover · Favourites · Basket · Profile
- **Vendor tabs**: Dashboard · Offers · Analytics · Profile
- React Navigation theme: `src/theme/navigationTheme.ts`

### Back button (uniform — customer & vendor)

**Always** use the shared `BackButton` component (`src/components/BackButton.tsx`). Never render a raw `arrow-back`, `chevron-left`, or text-only “Back” link in screen headers.

| Property | Value |
|----------|-------|
| Container | 36×36 circle (`w-9 h-9 rounded-full`) |
| Background | `bg-background` (`#F4F4F2`) — light gray fill, **no border** |
| Icon | `Ionicons` `chevron-back`, size **20**, color `text-primary` |
| Interaction | `activeOpacity={0.7}`, `hitSlop={8}` |

```tsx
import BackButton from '@/components/BackButton';

<BackButton onPress={() => navigation.goBack()} />
```

**Overlay variant** — only on full-bleed hero images with a dark scrim (e.g. offer details hero):

```tsx
<BackButton variant="overlay" onPress={() => navigation.goBack()} />
```

Uses `rgba(255,255,255,0.82)` fill; same `chevron-back` icon. Do **not** use `arrow-back`, Feather `chevron-left`, iOS-blue `#007AFF` text links, or bare chevrons without the circular container.

Pair with a matching circular icon button on the right when the header has a settings/action control (see `NotificationScreen`).

## Images

- Use `AuthImage` for authenticated CDN URLs
- Fallback: `bg-primary-100` + centered Ionicons (`bag-handle-outline`, `storefront-outline`)
- Always `contentFit="cover"` for food/vendor photos

## Status & urgency semantics

| State | Visual |
|-------|--------|
| Stock > 5 | Green quantity badge (`primary.DEFAULT`) |
| Stock 4–5 | Yellow badge (`warning` fill, white text) |
| Stock ≤ 3 | Red quantity badge (`error`) |
| Collect now | Day pill is red (`error`); LIVE accent section pill — quantity badge still follows stock tier |
| Sold out / expired | Grey badge (`text.secondary`), 50% card opacity, no tap |
| Favorite | `heart` filled `favorite` red · outline `text-secondary` |
| Order status (vendor) | Text-only colored label — no filled badge backgrounds |

Always use `getQuantityLeftBadgeStyle(offer.quantityAvailable)` — never inline these conditions.

## Screen-building checklist

Before finishing a screen, verify:

- [ ] `bg-background` screen root with safe-area insets
- [ ] All colors from tokens (no stray hex in JSX)
- [ ] All strings from i18n
- [ ] Tap targets ≥ 44dp effective (use hitSlop if visual is smaller)
- [ ] Loading, empty, and error states styled consistently
- [ ] Horizontal scrolls hide indicator; vertical scrolls `showsVerticalScrollIndicator={false}`
- [ ] Cards/inputs use standard radius and shadow
- [ ] Matches relevant `design_mockups/*.html` if one exists
- [ ] Every focused input stays above the keyboard; modal editors use `KeyboardAvoidingView`

## Additional reference

For full token tables, mockup file index, and copy-paste snippets, see [reference.md](reference.md).
