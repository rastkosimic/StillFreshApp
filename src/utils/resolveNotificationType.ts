import { Notification, NotificationType, OrderStatus } from '@/types';

const ALL_TYPES: NotificationType[] = [
  'ORDER_CONFIRMED',
  'ORDER_RECEIVED',
  'ORDER_CANCELLED',
  'ORDER_EXPIRED',
  'ORDER_PICKUP_REMINDER',
  'PAYMENT_SUCCESSFUL',
  'PAYMENT_FAILED',
  'BANK_TRANSFER_INITIATED',
  'BANK_TRANSFER_CONFIRMED',
  'BANKING_MODEL_CHANGED',
  'SYSTEM_ALERT',
];

function isNotificationType(value: string | undefined): value is NotificationType {
  return value != null && ALL_TYPES.includes(value as NotificationType);
}

const ORDER_STATUS_TO_TYPE: Partial<Record<OrderStatus, NotificationType>> = {
  EXPIRED: 'ORDER_EXPIRED',
  CANCELLED: 'ORDER_CANCELLED',
  COMPLETED: 'PAYMENT_SUCCESSFUL',
  CONFIRMED: 'ORDER_RECEIVED',
  PROCESSING: 'ORDER_RECEIVED',
  READY: 'ORDER_RECEIVED',
  PENDING: 'ORDER_RECEIVED',
};

export function getNotificationOrderId(notification: Notification): string | null {
  const data = notification.data ?? {};
  const orderId = data.orderId ?? data.requestId;
  return orderId != null && orderId !== '' ? String(orderId) : null;
}

export function notificationTypeFromOrderStatus(status: OrderStatus): NotificationType {
  return ORDER_STATUS_TO_TYPE[status] ?? 'ORDER_RECEIVED';
}

/** Infer type from backend English (or mixed) title/message before client localization. */
function inferTypeFromRawText(title?: string | null, message?: string | null): NotificationType | null {
  const text = `${title ?? ''} ${message ?? ''}`.toLowerCase();
  if (!text.trim()) return null;

  if (/expir|istekl/i.test(text)) return 'ORDER_EXPIRED';
  if (/cancel|otkazan/i.test(text)) return 'ORDER_CANCELLED';
  if (
    /complet|završ|finished|picked up|pickup confirm|preuzet|captured|settled|paid out/i.test(text)
  ) {
    return 'PAYMENT_SUCCESSFUL';
  }
  if (/reminder|podsetnik|pick up before/i.test(text)) return 'ORDER_PICKUP_REMINDER';
  if (/payment failed|plaćanje nije|payment unsuccessful/i.test(text)) return 'PAYMENT_FAILED';
  if (/new order|order received|nova narudžb|nova rezerv|stigla je nova/i.test(text)) {
    return 'ORDER_RECEIVED';
  }
  if (/order confirmed|narudžbina potvrđena|potvrđena/i.test(text)) return 'ORDER_CONFIRMED';

  return null;
}

/**
 * Resolves the effective notification type for display and routing.
 * When `liveOrderStatus` is supplied (from GET /orders/{id}), it takes precedence.
 */
export function resolveNotificationType(
  notification: Notification,
  liveOrderStatus?: OrderStatus,
): NotificationType {
  if (liveOrderStatus != null) {
    return notificationTypeFromOrderStatus(liveOrderStatus);
  }

  const data = notification.data ?? {};
  const dataType = typeof data.type === 'string' ? data.type : undefined;
  const eventType = typeof data.eventType === 'string' ? data.eventType : undefined;
  const dataOrderStatus =
    typeof data.orderStatus === 'string'
      ? data.orderStatus
      : typeof data.status === 'string'
        ? data.status
        : typeof data.orderState === 'string'
          ? data.orderState
          : undefined;

  if (dataOrderStatus != null) {
    const mapped = ORDER_STATUS_TO_TYPE[dataOrderStatus as OrderStatus];
    if (mapped != null) return mapped;
  }

  if (isNotificationType(eventType)) return eventType;

  if (isNotificationType(dataType) && dataType !== notification.type) {
    return dataType;
  }

  const inferred = inferTypeFromRawText(notification.title, notification.message);
  if (inferred != null && notification.type === 'ORDER_RECEIVED' && inferred !== 'ORDER_RECEIVED') {
    return inferred;
  }
  if (inferred != null && !isNotificationType(notification.type)) {
    return inferred;
  }

  if (isNotificationType(dataType)) return dataType;
  if (isNotificationType(notification.type)) return notification.type;

  return 'SYSTEM_ALERT';
}

export type OrderNotificationBadge =
  | 'reserved'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'reminder'
  | 'payment'
  | 'other';

export function notificationBadgeKind(type: NotificationType): OrderNotificationBadge {
  switch (type) {
    case 'ORDER_RECEIVED':
    case 'ORDER_CONFIRMED':
      return 'reserved';
    case 'PAYMENT_SUCCESSFUL':
      return 'completed';
    case 'ORDER_EXPIRED':
      return 'expired';
    case 'ORDER_CANCELLED':
      return 'cancelled';
    case 'ORDER_PICKUP_REMINDER':
      return 'reminder';
    case 'PAYMENT_FAILED':
      return 'payment';
    default:
      return 'other';
  }
}
