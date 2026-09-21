import { colors } from '@/theme/colors';
import { OrderStatus } from '@/types';

export function orderStatusI18nKey(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PENDING: 'customer.orderStatusPending',
    CONFIRMED: 'customer.orderStatusConfirmed',
    PROCESSING: 'customer.orderStatusProcessing',
    READY: 'customer.orderStatusReady',
    COMPLETED: 'customer.orderStatusCompleted',
    CANCELLED: 'customer.orderStatusCancelled',
    EXPIRED: 'customer.orderStatusExpired',
  };
  return map[status];
}

export function orderStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return colors.primary.DEFAULT;
    case 'PROCESSING':
      return colors.warning;
    case 'READY':
      return colors.success;
    case 'COMPLETED':
      return colors.text.secondary;
    case 'CANCELLED':
    case 'EXPIRED':
      return colors.error;
    default:
      return colors.text.secondary;
  }
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return status === 'CONFIRMED' || status === 'PROCESSING' || status === 'READY';
}

const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

/** Vendor may reject/cancel any order that is not already finished. */
export function canRejectOrder(status: OrderStatus): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(status);
}
