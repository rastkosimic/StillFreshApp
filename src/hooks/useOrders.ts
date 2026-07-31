import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cancelOrder,
  confirmPickup,
  getOrders,
} from '@/services/orderService';
import { useLocationStore } from '@/stores/locationStore';
import { ACTIVE_ORDER_STATUSES, Order, OrderStatus } from '@/types';
import { pollOrderStatus } from '@/utils/orderPolling';

interface UseOrdersOptions {
  status?: OrderStatus | OrderStatus[];
}

interface UseOrdersResult {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  totalElements: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  markRemoved: (orderId: number | string) => void;
  confirmPickupWithPolling: (orderId: number | string) => Promise<Order>;
  cancelOrderWithLocation: (orderId: number | string, reason?: string) => Promise<void>;
}

function matchesStatusFilter(order: Order, filter?: OrderStatus | OrderStatus[]): boolean {
  if (!filter) return true;
  if (Array.isArray(filter)) return filter.includes(order.status);
  return order.status === filter;
}

export function useOrders(options: UseOrdersOptions = {}): UseOrdersResult {
  const { status: statusFilter } = options;
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const removedIdsRef = useRef<Set<string>>(new Set());

  const apiStatus =
    statusFilter && !Array.isArray(statusFilter) ? statusFilter : undefined;

  const statusKey = Array.isArray(statusFilter)
    ? statusFilter.join(',')
    : statusFilter ?? 'all';

  const filterRemoved = useCallback((list: Order[]): Order[] => {
    return list.filter((o) => !removedIdsRef.current.has(String(o.id)));
  }, []);

  const applyClientFilter = useCallback(
    (list: Order[]): Order[] => {
      let filtered = filterRemoved(list);
      if (Array.isArray(statusFilter)) {
        filtered = filtered.filter((o) => matchesStatusFilter(o, statusFilter));
      }
      return filtered;
    },
    [statusFilter, filterRemoved],
  );

  const fetchPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getOrders(pageNum, 20, apiStatus);
        const content = applyClientFilter(result.content);
        setOrders((prev) => (reset ? content : [...prev, ...content]));
        setHasMore(!result.last);
        setPage(pageNum);
        setTotalElements(result.totalElements);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    },
    [apiStatus, applyClientFilter],
  );

  const refresh = useCallback(() => fetchPage(0, true), [fetchPage]);

  useEffect(() => {
    void fetchPage(0, true);
  }, [statusKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) return fetchPage(page + 1, false);
    return Promise.resolve();
  }, [fetchPage, isLoading, hasMore, page]);

  const markRemoved = useCallback((orderId: number | string) => {
    removedIdsRef.current.add(String(orderId));
    setOrders((prev) => prev.filter((o) => String(o.id) !== String(orderId)));
  }, []);

  const confirmPickupWithPolling = useCallback(async (orderId: number | string) => {
    await confirmPickup(orderId);
    return pollOrderStatus(orderId, 'COMPLETED');
  }, []);

  const cancelOrderWithLocation = useCallback(
    async (orderId: number | string, reason?: string) => {
      const { coordinates, getLocation } = useLocationStore.getState();
      let userLat = coordinates?.latitude;
      let userLon = coordinates?.longitude;

      if (userLat == null || userLon == null) {
        await getLocation();
        const updated = useLocationStore.getState().coordinates;
        userLat = updated?.latitude;
        userLon = updated?.longitude;
      }

      await cancelOrder(orderId, {
        reason,
        ...(userLat != null && userLon != null ? { userLat, userLon } : {}),
      });
      markRemoved(orderId);
    },
    [markRemoved],
  );

  return {
    orders,
    isLoading,
    error,
    hasMore,
    totalElements,
    loadMore,
    refresh,
    markRemoved,
    confirmPickupWithPolling,
    cancelOrderWithLocation,
  };
}

export { ACTIVE_ORDER_STATUSES };
