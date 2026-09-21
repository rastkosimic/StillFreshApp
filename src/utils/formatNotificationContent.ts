import { TFunction } from 'i18next';

import { Notification, NotificationType } from '@/types';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import {
  getNotificationOrderId,
  notificationBadgeKind,
  OrderNotificationBadge,
  resolveNotificationType,
} from '@/utils/resolveNotificationType';
import { orderStatusI18nKey } from '@/utils/orderStatus';
import { OrderStatus } from '@/types';

const TITLE_KEY: Record<NotificationType, string> = {
  ORDER_CONFIRMED: 'notifications.orderConfirmed',
  ORDER_RECEIVED: 'notifications.orderReceived',
  ORDER_CANCELLED: 'notifications.orderCancelled',
  ORDER_EXPIRED: 'notifications.orderExpired',
  ORDER_PICKUP_REMINDER: 'notifications.pickupReminder',
  PAYMENT_SUCCESSFUL: 'notifications.paymentSuccessful',
  PAYMENT_FAILED: 'notifications.paymentFailed',
  BANK_TRANSFER_INITIATED: 'notifications.bankTransferInitiated',
  BANK_TRANSFER_CONFIRMED: 'notifications.bankTransferConfirmed',
  BANKING_MODEL_CHANGED: 'notifications.bankingModelChanged',
  SYSTEM_ALERT: 'notifications.systemAlert',
};

const VENDOR_TITLE_KEY: Partial<Record<NotificationType, string>> = {
  ORDER_CONFIRMED: 'notifications.vendorOrderReserved',
  ORDER_RECEIVED: 'notifications.vendorOrderReserved',
  ORDER_CANCELLED: 'notifications.vendorOrderCancelled',
  ORDER_EXPIRED: 'notifications.vendorOrderExpired',
  ORDER_PICKUP_REMINDER: 'notifications.vendorPickupReminder',
  PAYMENT_SUCCESSFUL: 'notifications.vendorOrderCompleted',
  PAYMENT_FAILED: 'notifications.paymentFailed',
};

const MESSAGE_KEY: Record<NotificationType, { full: string; short: string }> = {
  ORDER_CONFIRMED: {
    full: 'notifications.msgOrderConfirmed',
    short: 'notifications.msgOrderConfirmedShort',
  },
  ORDER_RECEIVED: {
    full: 'notifications.msgOrderReceived',
    short: 'notifications.msgOrderReceivedShort',
  },
  ORDER_CANCELLED: {
    full: 'notifications.msgOrderCancelled',
    short: 'notifications.msgOrderCancelledShort',
  },
  ORDER_EXPIRED: {
    full: 'notifications.msgOrderExpired',
    short: 'notifications.msgOrderExpiredShort',
  },
  ORDER_PICKUP_REMINDER: {
    full: 'notifications.msgPickupReminder',
    short: 'notifications.msgPickupReminderShort',
  },
  PAYMENT_SUCCESSFUL: {
    full: 'notifications.msgPaymentSuccessful',
    short: 'notifications.msgPaymentSuccessfulShort',
  },
  PAYMENT_FAILED: {
    full: 'notifications.msgPaymentFailed',
    short: 'notifications.msgPaymentFailedShort',
  },
  BANK_TRANSFER_INITIATED: {
    full: 'notifications.msgBankTransferInitiated',
    short: 'notifications.msgBankTransferInitiatedShort',
  },
  BANK_TRANSFER_CONFIRMED: {
    full: 'notifications.msgBankTransferConfirmed',
    short: 'notifications.msgBankTransferConfirmedShort',
  },
  BANKING_MODEL_CHANGED: {
    full: 'notifications.msgBankingModelChanged',
    short: 'notifications.msgBankingModelChangedShort',
  },
  SYSTEM_ALERT: {
    full: 'notifications.msgSystemAlert',
    short: 'notifications.msgSystemAlertShort',
  },
};

const VENDOR_MESSAGE_KEY: Partial<
  Record<NotificationType, { full: string; short: string }>
> = {
  ORDER_CONFIRMED: {
    full: 'notifications.vendorMsgOrderReserved',
    short: 'notifications.vendorMsgOrderReservedShort',
  },
  ORDER_RECEIVED: {
    full: 'notifications.vendorMsgOrderReserved',
    short: 'notifications.vendorMsgOrderReservedShort',
  },
  ORDER_CANCELLED: {
    full: 'notifications.vendorMsgOrderCancelled',
    short: 'notifications.vendorMsgOrderCancelledShort',
  },
  ORDER_EXPIRED: {
    full: 'notifications.vendorMsgOrderExpired',
    short: 'notifications.vendorMsgOrderExpiredShort',
  },
  ORDER_PICKUP_REMINDER: {
    full: 'notifications.vendorMsgPickupReminder',
    short: 'notifications.vendorMsgPickupReminderShort',
  },
  PAYMENT_SUCCESSFUL: {
    full: 'notifications.vendorMsgOrderCompleted',
    short: 'notifications.vendorMsgOrderCompletedShort',
  },
};

const BADGE_LABEL_KEY: Record<OrderNotificationBadge, string | null> = {
  reserved: 'notifications.badgeReserved',
  completed: 'notifications.badgeCompleted',
  expired: 'notifications.badgeExpired',
  cancelled: 'notifications.badgeCancelled',
  reminder: 'notifications.badgeReminder',
  payment: 'notifications.badgePaymentFailed',
  other: null,
};

type ParsedParams = {
  orderId?: string;
  quantity?: number;
  total?: string;
  vendorName?: string;
  offerName?: string;
};

export type FormattedNotification = {
  title: string;
  message: string;
  type: NotificationType;
  badgeLabel: string | null;
  badgeKind: OrderNotificationBadge;
  orderStatus?: OrderStatus;
};

function parseIntSafe(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumberSafe(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Notification payloads send order totals in major units (e.g. 300 RSD), same as the order API. */
function parseAmountFromData(data: Record<string, string>): string | undefined {
  const currency = data.currency ?? data.currencyCode ?? 'RSD';
  const raw =
    data.totalAmount ?? data.totalPrice ?? data.amount ?? data.total ?? data.price;
  const amountMajor = parseNumberSafe(raw);
  if (amountMajor != null) return formatOrderAmount(amountMajor, currency);
  return undefined;
}

function parseTotalFromMessage(text: string): string | undefined {
  const totalMatch =
    text.match(/Total:\s*(.+?)(?:\.|$)/i) ??
    text.match(/Ukupno:\s*(.+?)(?:\.|$)/i) ??
    text.match(/(?:amount|iznos)(?:\s+of)?:\s*(.+?)(?:\.|$)/i) ??
    text.match(/(?:Payment of|Plaćanje od)\s+(.+?)(?:\s+was|\s+je|\.|$)/i);
  return totalMatch ? totalMatch[1].trim() : undefined;
}

/** Extract quantity / total / names from backend English (or mixed) message text. */
function parseFromMessage(message: string): ParsedParams {
  const params: ParsedParams = {};
  const text = message.trim();
  if (!text) return params;

  const quantityMatch =
    text.match(/(?:for|of)\s+(\d+)\s+items?/i) ??
    text.match(/(\d+)\s+items?/i) ??
    text.match(/(\d+)\s+stavk/i);
  if (quantityMatch) {
    params.quantity = Number.parseInt(quantityMatch[1], 10);
  }

  const total = parseTotalFromMessage(text);
  if (total) params.total = total;

  const vendorMatch = text.match(/(?:from|at|u)\s+(.+?)(?:\.|$)/i);
  if (vendorMatch && !params.total?.includes(vendorMatch[1])) {
    params.vendorName = vendorMatch[1].trim();
  }

  return params;
}

function parseFromData(data: Record<string, string> | undefined): ParsedParams {
  if (!data) return {};
  const params: ParsedParams = {};
  if (data.orderId) params.orderId = data.orderId;
  if (data.requestId && !params.orderId) params.orderId = data.requestId;
  const quantity = parseIntSafe(data.quantity ?? data.itemCount ?? data.items);
  if (quantity != null) params.quantity = quantity;
  const total = parseAmountFromData(data);
  if (total) params.total = total;
  if (data.vendorName) params.vendorName = data.vendorName;
  if (data.locationName) params.vendorName = data.locationName;
  if (data.chainName) params.vendorName = data.chainName;
  if (data.offerName) params.offerName = data.offerName;
  return params;
}

function mergeParams(dataParams: ParsedParams, messageParams: ParsedParams): ParsedParams {
  return {
    orderId: dataParams.orderId ?? messageParams.orderId,
    quantity: dataParams.quantity ?? messageParams.quantity,
    total: dataParams.total ?? messageParams.total,
    vendorName: dataParams.vendorName ?? messageParams.vendorName,
    offerName: dataParams.offerName ?? messageParams.offerName,
  };
}

function usesDetailedMessage(
  type: NotificationType,
  params: ParsedParams,
  isVendor: boolean,
): boolean {
  if (isVendor) {
    switch (type) {
      case 'ORDER_RECEIVED':
      case 'ORDER_CONFIRMED':
      case 'ORDER_EXPIRED':
      case 'PAYMENT_SUCCESSFUL':
        return params.orderId != null || (params.quantity != null && params.total != null);
      case 'ORDER_CANCELLED':
      case 'ORDER_PICKUP_REMINDER':
        return params.orderId != null;
      default:
        return false;
    }
  }

  switch (type) {
    case 'ORDER_CONFIRMED':
    case 'ORDER_RECEIVED':
      return params.quantity != null && params.total != null;
    case 'PAYMENT_SUCCESSFUL':
      return params.total != null;
    default:
      return false;
  }
}

function buildMessage(
  type: NotificationType,
  params: ParsedParams,
  t: TFunction,
  rawMessage: string | null | undefined,
  isVendor: boolean,
): string {
  if (type === 'SYSTEM_ALERT' && rawMessage?.trim()) {
    return rawMessage.trim();
  }

  const vendorKeys = isVendor ? VENDOR_MESSAGE_KEY[type] : undefined;
  const keys = vendorKeys ?? MESSAGE_KEY[type];
  const useFull = usesDetailedMessage(type, params, isVendor);
  const key = useFull ? keys.full : keys.short;

  const interpolation: Record<string, string | number> = {};
  if (params.orderId) interpolation.orderId = params.orderId;
  if (params.quantity != null) {
    interpolation.quantity = params.quantity;
    interpolation.count = params.quantity;
    interpolation.itemWord = t('notifications.itemCount', { count: params.quantity });
  }
  if (params.total) interpolation.total = params.total;
  if (params.vendorName) interpolation.vendorName = params.vendorName;
  if (params.offerName) interpolation.offerName = params.offerName;

  return t(key, interpolation);
}

/**
 * Returns localized title and message for a notification.
 * Backend payloads are often English — this rebuilds copy from resolved type, `data`, and parsed params.
 */
export function formatNotificationContent(
  notification: Notification,
  t: TFunction,
  options?: { isVendor?: boolean; orderStatus?: OrderStatus },
): FormattedNotification {
  const isVendor = options?.isVendor === true;
  const liveStatus = options?.orderStatus;
  const orderId = getNotificationOrderId(notification);
  const type = resolveNotificationType(notification, liveStatus);
  const badgeKind = notificationBadgeKind(type);

  const awaitingLiveStatus = isVendor && orderId != null && liveStatus == null;

  const badgeLabel = liveStatus != null
    ? t(orderStatusI18nKey(liveStatus))
    : awaitingLiveStatus
      ? null
      : (() => {
          const badgeLabelKey = BADGE_LABEL_KEY[badgeKind];
          return badgeLabelKey != null ? t(badgeLabelKey) : null;
        })();

  const params = mergeParams(
    parseFromData(notification.data),
    parseFromMessage(notification.message ?? ''),
  );

  const vendorTitleKey = isVendor ? VENDOR_TITLE_KEY[type] : undefined;

  const title =
    awaitingLiveStatus && orderId
      ? t('notifications.vendorOrderPending', { orderId })
      : t(vendorTitleKey ?? TITLE_KEY[type] ?? 'notifications.systemAlert');

  const message =
    awaitingLiveStatus && orderId
      ? t('notifications.vendorMsgOrderPending', { orderId })
      : buildMessage(type, params, t, notification.message, isVendor);

  return {
    title,
    message,
    type,
    badgeLabel,
    badgeKind,
    orderStatus: liveStatus,
  };
}
