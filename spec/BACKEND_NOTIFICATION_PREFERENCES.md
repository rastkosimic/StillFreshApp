# Backend task: fix `POST /api/notifications/preferences` returning 400

**Context:** Users cannot save notification settings in the mobile app. Toggling push notifications or individual notification types shows an error (*"Unable to save notification preferences"*) even though the request reaches the notification service.

---

## Observed behaviour (production log)

```
POST "/api/notifications/preferences", parameters={}
Mapped to NotificationController#updatePreferences(HttpServletRequest, String, Map)
Read "application/json;charset=UTF-8" to [{pushEnabled=true, emailEnabled=false, smsEnabled=false, enabledTypes=[PAYMENT_FAILED, BANK_TRANSFER ... (truncated)]}]
Writing [com.stillfresh.app.notificationservice.dto.ApiResponse@...]
Completed 400 BAD_REQUEST
```

**Interpretation:**

- Request URL, method, and JSON body are valid — Spring parses the body successfully.
- Failure happens **inside** `updatePreferences` after mapping, not due to malformed JSON or routing.
- Mobile treats any HTTP 4xx as a hard failure and shows the save error to the user.

---

## Mobile request contract (what the app sends)

The app posts **only** these four fields (no `id`, `userId`, `createdAt`, `updatedAt`):

```json
{
  "pushEnabled": true,
  "emailEnabled": false,
  "smsEnabled": false,
  "enabledTypes": [
    "ORDER_CONFIRMED",
    "PAYMENT_FAILED",
    "BANK_TRANSFER_INITIATED"
  ]
}
```

- `enabledTypes` values are uppercase enum strings from the list below.
- Duplicates are removed client-side before send.
- `pushEnabled: false` may be sent with a non-empty `enabledTypes` array (types are preserved so re-enabling push restores them).

**Endpoint:** `POST /api/notifications/preferences`  
**Auth:** `Authorization: Bearer {jwt}` (same as other notification endpoints)

---

## Expected response contract

Per `APP_SPEC.md`, success should be:

**HTTP 200** with body:

```json
{
  "success": true,
  "message": "Preferences updated",
  "data": {
    "pushEnabled": true,
    "emailEnabled": false,
    "smsEnabled": false,
    "enabledTypes": ["ORDER_CONFIRMED", "PAYMENT_FAILED"]
  }
}
```

On validation failure, either:

- **HTTP 200** with `{ "success": false, "message": "...", "error": "..." }` (mobile can surface `message`), **or**
- **HTTP 400** with a clear `message` / `error` in the `ApiResponse` body explaining which rule failed.

Today the service returns **HTTP 400** without the mobile team being able to see the `ApiResponse` message in normal error handling.

---

## Allowed `enabledTypes` values (mobile enum)

```
ORDER_CONFIRMED
ORDER_RECEIVED
ORDER_CANCELLED
ORDER_EXPIRED
ORDER_PICKUP_REMINDER
PAYMENT_SUCCESSFUL
PAYMENT_FAILED
BANK_TRANSFER_INITIATED
BANK_TRANSFER_CONFIRMED
BANKING_MODEL_CHANGED
SYSTEM_ALERT
```

---

## Role-specific types shown in the UI

| Role | Types user can toggle in app |
|------|------------------------------|
| Customer | `ORDER_CONFIRMED`, `ORDER_CANCELLED`, `ORDER_EXPIRED`, `ORDER_PICKUP_REMINDER`, `PAYMENT_SUCCESSFUL`, `PAYMENT_FAILED`, `BANK_TRANSFER_INITIATED`, `BANK_TRANSFER_CONFIRMED` |
| Vendor | `ORDER_RECEIVED`, `ORDER_CANCELLED`, `BANKING_MODEL_CHANGED` |

**Important:** `enabledTypes` in the POST body may still contain types **not shown** in the vendor UI (e.g. customer types loaded from defaults or a previous GET). Backend must either:

1. **Accept and persist** any valid enum in `enabledTypes` regardless of role, **or**
2. **Document and return a clear error** if role-based filtering is required — mobile will then filter before send.

Do not return a generic 400 without logging which validation failed.

---

## Likely backend causes to investigate

Check validation / business rules in `NotificationController#updatePreferences` and the service layer:

| Rule | Question |
|------|----------|
| Empty `enabledTypes` | Is `enabledTypes = []` allowed when `pushEnabled = true`? When `pushEnabled = false`? |
| Minimum types | Must at least one type remain enabled while push is on? |
| Role validation | Does the backend reject customer-only types for vendor JWTs (or vice versa)? |
| Enum mapping | Are all 11 type strings recognized by the server enum / DB? |
| User resolution | Is the user ID resolved correctly from JWT? (Should be 401 if auth fails, not 400.) |
| Upsert vs update | Does the endpoint require an existing preferences row? Should it create on first save? |

**Action:** Log the `ApiResponse.message` / `error` at WARN level when returning 400 so the exact rule is visible in service logs.

---

## Reproduction scenarios (acceptance tests)

### 1. Turn off one notification type (customer)

```json
POST /api/notifications/preferences
{
  "pushEnabled": true,
  "emailEnabled": false,
  "smsEnabled": false,
  "enabledTypes": ["ORDER_CONFIRMED", "ORDER_CANCELLED", "ORDER_EXPIRED", "ORDER_PICKUP_REMINDER", "PAYMENT_SUCCESSFUL", "BANK_TRANSFER_INITIATED", "BANK_TRANSFER_CONFIRMED"]
}
```
(with `PAYMENT_FAILED` removed)

→ **200**, `success: true`, persisted preferences reflected on next `GET`.

### 2. Turn off push master toggle

```json
{
  "pushEnabled": false,
  "emailEnabled": false,
  "smsEnabled": false,
  "enabledTypes": ["ORDER_CONFIRMED", "PAYMENT_FAILED", "..."]
}
```

→ **200** (or document if `enabledTypes` must be `[]` when push is off).

### 3. Vendor toggles off `ORDER_RECEIVED`

```json
{
  "pushEnabled": true,
  "emailEnabled": false,
  "smsEnabled": false,
  "enabledTypes": ["ORDER_CANCELLED", "BANKING_MODEL_CHANGED"]
}
```

→ **200** for vendor JWT.

### 4. Round-trip

`GET /api/notifications/preferences` after each successful POST must return the same `pushEnabled` and `enabledTypes` that were saved.

---

## Acceptance criteria

- [ ] `POST /api/notifications/preferences` returns **HTTP 200** with `success: true` for all valid payloads above.
- [ ] Toggling any setting off in the mobile app persists and survives app restart / logout-login.
- [ ] Invalid requests return a **specific** `message` in `ApiResponse` (logged server-side).
- [ ] Validation rules (empty array, role scoping, push-off behaviour) are documented in the API spec or controller JavaDoc.

---

## Out of scope

- Email / SMS delivery implementation (mobile only toggles flags; email note says email is managed automatically).
- New notification types beyond the 11 listed above.

---

## Mobile follow-up (after backend fix)

Once the backend documents validation rules:

- If role-scoped `enabledTypes` is required, mobile will filter `enabledTypes` to role-allowed values before POST.
- If `pushEnabled: false` requires `enabledTypes: []`, mobile will clear the array on master toggle off.

No mobile change is needed if the backend accepts the current payload shape and returns 200.
