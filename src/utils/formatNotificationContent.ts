import { TFunction } from 'i18next';

import { Notification, NotificationType } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';

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

type ParsedParams = {
  quantity?: number;
  total?: string;
  vendorName?: string;
  offerName?: string;
};

function parseIntSafe(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseAmountFromData(data: Record<string, string>): string | undefined {
  const currency = data.currency ?? data.currencyCode ?? 'RSD';
  const centsRaw =
    data.totalAmount ?? data.totalPrice ?? data.amount ?? data.total ?? data.price;
  const cents = parseIntSafe(centsRaw);
  if (cents != null) return formatCurrency(cents, currency);
  return undefined;
}

/** Extract quantity / total / names from backend English (or mixed) message text. */
function parseFromMessage(message: string): ParsedParams {
  const params: ParsedParams = {};
  const text = message.trim();
  if (!text) return params;

  const quantityMatch =
    text.match(/(?:for|of)\s+(\d+)\s+items?/i) ??
    text.match(/(\d+)\s+items?/i);
  if (quantityMatch) {
    params.quantity = Number.parseInt(quantityMatch[1], 10);
  }

  const totalMatch =
    text.match(/Total:\s*(.+?)(?:\.|$)/i) ??
    text.match(/(?:amount|iznos)(?:\s+of)?:\s*(.+?)(?:\.|$)/i) ??
    text.match(/(?:Payment of|Plaćanje od)\s+(.+?)(?:\s+was|\s+je|\.|$)/i);
  if (totalMatch) {
    params.total = totalMatch[1].trim();
  }

  const vendorMatch = text.match(/(?:from|at|u)\s+(.+?)(?:\.|$)/i);
  if (vendorMatch && !params.total?.includes(vendorMatch[1])) {
    params.vendorName = vendorMatch[1].trim();
  }

  return params;
}

function parseFromData(data: Record<string, string> | undefined): ParsedParams {
  if (!data) return {};
  const params: ParsedParams = {};
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
    quantity: dataParams.quantity ?? messageParams.quantity,
    total: dataParams.total ?? messageParams.total,
    vendorName: dataParams.vendorName ?? messageParams.vendorName,
    offerName: dataParams.offerName ?? messageParams.offerName,
  };
}

function usesDetailedMessage(type: NotificationType, params: ParsedParams): boolean {
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
  rawMessage?: string | null,
): string {
  if (type === 'SYSTEM_ALERT' && rawMessage?.trim()) {
    return rawMessage.trim();
  }

  const keys = MESSAGE_KEY[type];
  const useFull = usesDetailedMessage(type, params);
  const key = useFull ? keys.full : keys.short;

  const interpolation: Record<string, string | number> = {};
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
 * Backend payloads are often English — this rebuilds copy from `type`, `data`, and parsed params.
 */
export function formatNotificationContent(
  notification: Notification,
  t: TFunction,
): { title: string; message: string } {
  const type = notification.type;
  const title = t(TITLE_KEY[type] ?? 'notifications.systemAlert');

  const params = mergeParams(
    parseFromData(notification.data),
    parseFromMessage(notification.message ?? ''),
  );

  const message = buildMessage(type, params, t, notification.message);
  return { title, message };
}
