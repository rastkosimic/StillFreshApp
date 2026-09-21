import apiClient from './apiClient';
import { getOfferById } from '@/services/offerService';
import {
  ACTIVE_ORDER_STATUSES,
  CancelOrderRequest,
  Order,
  OrderStatus,
  Page,
  PlaceOrderResponse,
  RejectOrderRequest,
  SuccessResponse,
} from '@/types';

type RawOrder = Record<string, unknown>;

const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export function getOrderVendorId(order: Order): number | null {
  const id = order.vendorId ?? order.offer?.vendorId;
  return id != null ? Number(id) : null;
}

export function getOrderVendorName(order: Order): string {
  return (
    order.chainName ??
    order.locationName ??
    order.offer?.chainName ??
    order.offer?.locationName ??
    ''
  );
}

export function canMarkPickedUp(order: Order): boolean {
  if (order.status === 'READY') {
    return true;
  }
  return order.paymentIntentId != null && !TERMINAL_STATUSES.includes(order.status);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function normalizeOrder(raw: RawOrder): Order {
  const id = (raw.id ?? raw.orderId) as number | string;
  const nestedOffer =
    raw.offer != null && typeof raw.offer === 'object'
      ? (raw.offer as RawOrder)
      : undefined;

  return {
    id,
    orderId: id,
    offerId: raw.offerId as number | string,
    vendorId: raw.vendorId as number | string | undefined,
    userId: raw.userId as number | string | undefined,
    status: raw.status as OrderStatus,
    quantity: raw.quantity as number,
    unitPrice: raw.unitPrice as number | undefined,
    totalPrice: raw.totalPrice as number,
    currency: raw.currency as string | undefined,
    paymentIntentId: raw.paymentIntentId as string | undefined,
    paymentMethod: raw.paymentMethod as string | undefined,
    pickupBy: raw.pickupBy as string | undefined,
    pickupStartTime:
      asNonEmptyString(raw.pickupStartTime) ?? asNonEmptyString(nestedOffer?.pickupStartTime),
    pickupEndTime:
      asNonEmptyString(raw.pickupEndTime) ?? asNonEmptyString(nestedOffer?.pickupEndTime),
    pickupDate: asNonEmptyString(raw.pickupDate) ?? asNonEmptyString(nestedOffer?.pickupDate),
    createdAt: raw.createdAt as string | undefined,
    updatedAt: raw.updatedAt as string | undefined,
    cancellationReason: raw.cancellationReason as string | undefined,
    latitude: raw.latitude as number | undefined,
    longitude: raw.longitude as number | undefined,
    locationName: raw.locationName as string | undefined,
    chainName: raw.chainName as string | undefined,
    website: raw.website as string | undefined,
    vendorImageUrl: raw.vendorImageUrl as string | undefined,
    offerName: raw.offerName as string | undefined,
    offerImageUrl: raw.offerImageUrl as string | undefined,
    address: raw.address as string | undefined,
    zipCode: raw.zipCode as string | undefined,
    grossAmountCents: raw.grossAmountCents as number | undefined,
    platformFeeCents: raw.platformFeeCents as number | undefined,
    netAmountCents: raw.netAmountCents as number | undefined,
    feePercentApplied: raw.feePercentApplied as number | undefined,
    settledAt: raw.settledAt as string | undefined,
  };
}

async function attachOfferPickup(order: Order): Promise<Order> {
  if (
    order.offerId == null ||
    (order.pickupDate != null &&
      order.pickupStartTime != null &&
      order.pickupEndTime != null)
  ) {
    return order;
  }

  try {
    const offer = await getOfferById(order.offerId);
    return {
      ...order,
      pickupDate: order.pickupDate ?? offer.pickupDate,
      pickupStartTime: order.pickupStartTime ?? offer.pickupStartTime,
      pickupEndTime: order.pickupEndTime ?? offer.pickupEndTime,
    };
  } catch {
    return order;
  }
}

function normalizePage(raw: Page<RawOrder>): Page<Order> {
  return {
    ...raw,
    content: raw.content.map(normalizeOrder),
  };
}

/**
 * Submits an async place-order request. The 200 response only means the pipeline
 * started — poll payment-status, then GET /orders for the new CONFIRMED row.
 */
export async function placeOrder(
  offerId: number | string,
  quantity: number,
  requestId: string,
): Promise<PlaceOrderResponse> {
  const response = await apiClient.post<PlaceOrderResponse | string>('/orders/place-order', {
    offerId,
    quantity,
    requestId,
  });

  const data = response.data;
  if (typeof data === 'object' && data !== null && 'requestId' in data) {
    return data;
  }

  return {
    message: typeof data === 'string' ? data : 'Order request submitted successfully.',
    requestId,
  };
}

export async function getOrders(
  page = 0,
  size = 20,
  status?: OrderStatus,
): Promise<Page<Order>> {
  const response = await apiClient.get<Page<RawOrder>>('/orders', {
    params: { page, size, ...(status ? { status } : {}) },
  });
  return normalizePage(response.data);
}

export async function getActiveOrders(page = 0, size = 20): Promise<Page<Order>> {
  const pages = await Promise.all(
    ACTIVE_ORDER_STATUSES.map((status) => getOrders(page, size, status)),
  );

  const merged = pages
    .flatMap((result) => result.content)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const content = await Promise.all(merged.map(attachOfferPickup));

  const totalElements = pages.reduce((sum, result) => sum + result.totalElements, 0);
  const hasMore = pages.some((result) => !result.last);

  return {
    content,
    totalElements,
    totalPages: Math.max(...pages.map((result) => result.totalPages), 1),
    number: page,
    size,
    first: page === 0,
    last: !hasMore,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

export async function getActiveBasketCount(): Promise<number> {
  const pages = await Promise.all(
    ACTIVE_ORDER_STATUSES.map((status) => getOrders(0, 1, status)),
  );
  return pages.reduce((sum, page) => sum + page.totalElements, 0);
}

export async function getOrderById(orderId: number | string): Promise<Order> {
  const response = await apiClient.get<RawOrder>(`/orders/${orderId}`);
  return attachOfferPickup(normalizeOrder(response.data));
}

/**
 * Customer confirms pickup. Triggers async payment capture on the backend.
 * Poll GET /orders/{id} until status === COMPLETED.
 */
export async function confirmPickup(orderId: number | string): Promise<SuccessResponse> {
  const response = await apiClient.put<SuccessResponse>(`/orders/${orderId}/confirm-pickup`);
  return response.data;
}

export async function cancelOrder(
  orderId: number | string,
  body: CancelOrderRequest = {},
): Promise<SuccessResponse> {
  const response = await apiClient.put<SuccessResponse>(`/orders/${orderId}/cancel`, body);
  return response.data;
}

export async function rejectOrder(
  orderId: number | string,
  body: RejectOrderRequest = {},
): Promise<SuccessResponse> {
  const response = await apiClient.put<SuccessResponse>(`/orders/${orderId}/reject`, body);
  return response.data;
}

export async function updateOrderStatus(
  orderId: number | string,
  status: string,
): Promise<Order> {
  const response = await apiClient.put<RawOrder>(`/orders/${orderId}/status`, { status });
  return normalizeOrder(response.data);
}
