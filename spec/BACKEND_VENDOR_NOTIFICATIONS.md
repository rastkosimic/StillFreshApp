# Backend task: enable vendor notification → order detail flow

**Context:** The mobile app routes vendor order notifications to `VendorOrderDetail` using `data.orderId`. Vendors load order details via `GET /orders/{orderId}` (option A — implemented).

---

## 1. Allow vendors to fetch one order by ID ✅ Option A

**Implemented:** `GET /orders/{orderId}` allows access when the authenticated user is the **customer who placed the order** OR a **vendor/worker assigned to that order’s location**.

- Return the same `Order` shape the customer endpoint uses (`id`, `offerId`, `offerName`, `offerImageUrl`, `status`, `quantity`, `totalPrice`, `currency`, `pickupBy`, `paymentMethod`, settlement fields for `COMPLETED` orders, etc.).
- **Authorization rule:** vendor may only read orders for their own location(s).

**Mobile:** `VendorOrderDetailScreen` loads via `getOrderById(orderId)`.

---

## 2. Populate notification `data` for order-related pushes

For all order notification types (`ORDER_RECEIVED`, `ORDER_CONFIRMED`, `ORDER_CANCELLED`, `ORDER_EXPIRED`, `ORDER_PICKUP_REMINDER`, `PAYMENT_SUCCESSFUL`, `PAYMENT_FAILED`), ensure both:

- **Stored notification** (`GET /api/notifications/user`)
- **FCM push payload** (`data` map)

include at minimum:

```json
{
  "type": "ORDER_RECEIVED",
  "orderId": "123"
}
```

Use string values in `data` (FCM requirement). `orderId` must match the order the notification refers to.

---

## 3. Persist read state (do not rely on client-only fixes)

These endpoints must update the DB and be reflected on the next fetch:

- `POST /api/notifications/mark-read/{id}` → set `isRead: true`, `status: READ`
- `POST /api/notifications/mark-all-read` → mark all unread notifications for the current user as read

`GET /api/notifications/user` must return accurate `isRead` after logout/login.

Response wrapper (already expected by mobile):

```json
{ "success": true, "message": "...", "data": [ /* Notification[] */ ] }
```

---

## 4. Notification object shape (mobile contract)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "ORDER_RECEIVED",
  "title": "New order",
  "message": "...",
  "status": "SENT",
  "data": { "type": "ORDER_RECEIVED", "orderId": "123" },
  "isRead": false,
  "deleted": false,
  "createdAt": "ISO-8601",
  "sentAt": "ISO-8601"
}
```

---

## 5. Acceptance criteria

- Vendor taps an `ORDER_*` notification → mobile calls `GET /orders/{orderId}` → **200 with full order**, not 403/404.
- Push and inbox notifications for orders always include `data.orderId` and `data.type`.
- Mark read / mark all read survives logout + login without notifications reverting to unread.

---

## 6. Out of scope for this task

- Customer-only actions (`confirm-pickup`, `cancel`) — no change needed.
- New notification types — use existing 11 types only.

