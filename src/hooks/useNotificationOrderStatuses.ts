import { useEffect, useMemo, useState } from 'react';

import { getOrderById } from '@/services/orderService';
import { Notification, OrderStatus } from '@/types';
import { getNotificationOrderId } from '@/utils/resolveNotificationType';

/**
 * Loads live order statuses for notifications that reference an order —
 * same source as VendorOrderDetailScreen / OrderDetailScreen (`GET /orders/{id}`).
 */
export function useNotificationOrderStatuses(
  notifications: Notification[],
  enabled: boolean,
): { statusByOrderId: Record<string, OrderStatus>; isLoadingStatuses: boolean } {
  const orderIds = useMemo(() => {
    if (!enabled) return [] as string[];
    const ids = notifications
      .map(getNotificationOrderId)
      .filter((id): id is string => id != null);
    return [...new Set(ids)];
  }, [notifications, enabled]);

  const orderIdsKey = orderIds.join(',');

  const [statusByOrderId, setStatusByOrderId] = useState<Record<string, OrderStatus>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  useEffect(() => {
    const ids = orderIdsKey.length > 0 ? orderIdsKey.split(',') : [];
    if (!enabled || ids.length === 0) {
      setStatusByOrderId({});
      setIsLoadingStatuses(false);
      return;
    }

    let cancelled = false;
    setIsLoadingStatuses(true);

    void Promise.allSettled(
      ids.map(async (orderId) => {
        const order = await getOrderById(orderId);
        return { orderId, status: order.status };
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, OrderStatus> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          next[result.value.orderId] = result.value.status;
        }
      }
      setStatusByOrderId(next);
      setIsLoadingStatuses(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, orderIdsKey]);

  return { statusByOrderId, isLoadingStatuses };
}
