import apiClient from './apiClient';
import {
  CancelOrderRequest,
  Order,
  OrderStatus,
  Page,
  PlaceOrderResponse,
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

export function normalizeOrder(raw: RawOrder): Order {
  const id = (raw.id ?? raw.orderId) as number | string;
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
    pickupStartTime: raw.pickupStartTime as string | undefined,
    pickupEndTime: raw.pickupEndTime as string | undefined,
    pickupDate: raw.pickupDate as string | undefined,
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

export async function getOrderById(orderId: number | string): Promise<Order> {
  const response = await apiClient.get<RawOrder>(`/orders/${orderId}`);
  return normalizeOrder(response.data);
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

export async function rejectOrder(orderId: number | string): Promise<Order> {
  const response = await apiClient.put<RawOrder>(`/orders/${orderId}/reject`);
  return normalizeOrder(response.data);
}

export async function updateOrderStatus(
  orderId: number | string,
  status: string,
): Promise<Order> {
  const response = await apiClient.put<RawOrder>(`/orders/${orderId}/status`, { status });
  return normalizeOrder(response.data);
}
