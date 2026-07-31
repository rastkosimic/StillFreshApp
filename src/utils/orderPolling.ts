import { getAllSecurePaymentMethods, getPaymentStatus } from '@/services/allSecurePaymentService';
import { getOrderById, getOrders } from '@/services/orderService';
import { AllSecurePaymentStatusValue, Order, OrderStatus } from '@/types';

export class OrderConfirmationTimeoutError extends Error {
  constructor(message = 'Order was not confirmed. Payment may have failed or is still pending.') {
    super(message);
    this.name = 'OrderConfirmationTimeoutError';
  }
}

export class PickupCaptureTimeoutError extends Error {
  constructor(message = 'Pickup confirmation timed out. Please check your order status.') {
    super(message);
    this.name = 'PickupCaptureTimeoutError';
  }
}

export class CardRegistrationTimeoutError extends Error {
  constructor(message = 'Card registration timed out. Please try again.') {
    super(message);
    this.name = 'CardRegistrationTimeoutError';
  }
}

export class PaymentFailedError extends Error {
  readonly failureReason?: string;

  constructor(failureReason?: string) {
    super(failureReason ?? 'Payment failed');
    this.name = 'PaymentFailedError';
    this.failureReason = failureReason;
  }
}

export class PaymentStatusTimeoutError extends Error {
  constructor(message = 'Payment was not confirmed in time.') {
    super(message);
    this.name = 'PaymentStatusTimeoutError';
  }
}

export class PaymentAbortedError extends Error {
  constructor() {
    super('Payment flow aborted');
    this.name = 'PaymentAbortedError';
  }
}

export interface PaymentAuthorizedResult {
  offerId?: number;
  paymentIntentId?: string;
}

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

const DEFAULT_POLL: Required<PollOptions> = {
  intervalMs: 2000,
  maxAttempts: 30,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollForNewOrder(
  offerId: number | string,
  knownOrderIds: Set<string | number>,
  options?: PollOptions,
): Promise<Order> {
  const { intervalMs, maxAttempts } = { ...DEFAULT_POLL, ...options };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(intervalMs);

    const page = await getOrders(0, 20);
    const candidates = page.content.filter(
      (order) =>
        String(order.offerId) === String(offerId) &&
        order.status === 'CONFIRMED' &&
        !knownOrderIds.has(order.id),
    );

    if (candidates.length > 0) {
      // Prefer newest by createdAt when multiple matches exist
      const sorted = [...candidates].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      return sorted[0];
    }
  }

  throw new OrderConfirmationTimeoutError();
}

export async function pollOrderStatus(
  orderId: number | string,
  targetStatus: OrderStatus,
  options?: PollOptions,
): Promise<Order> {
  const { intervalMs, maxAttempts } = { ...DEFAULT_POLL, ...options };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(intervalMs);

    const order = await getOrderById(orderId);
    if (order.status === targetStatus) {
      return order;
    }
  }

  throw new PickupCaptureTimeoutError();
}

/** Poll until at least one card appears (default flag optional — backend sets default on first card). */
export async function pollForRegisteredCard(options?: PollOptions): Promise<void> {
  const cardPollDefaults: Required<PollOptions> = {
    intervalMs: 2000,
    maxAttempts: 60, // 2 minutes — AllSecure callback can lag behind the browser return URL
  };
  const { intervalMs, maxAttempts } = { ...cardPollDefaults, ...options };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(intervalMs);

    const methods = await getAllSecurePaymentMethods();
    if (methods.length > 0) {
      return;
    }
  }

  throw new CardRegistrationTimeoutError();
}

/** @deprecated Use pollForRegisteredCard */
export const pollForDefaultCard = pollForRegisteredCard;

const PAYMENT_STATUS_POLL: Required<PollOptions> = {
  intervalMs: 1500,
  maxAttempts: 60,
};

function normalizePaymentStatus(raw: string): AllSecurePaymentStatusValue {
  const upper = raw.toUpperCase();
  if (
    upper === 'PROCESSING' ||
    upper === 'AUTHENTICATION_REQUIRED' ||
    upper === 'AUTHORIZED' ||
    upper === 'FAILED'
  ) {
    return upper;
  }
  return 'PROCESSING';
}

/**
 * Poll GET /payment/allsecure/payment-status/{requestId} until AUTHORIZED or FAILED.
 * Invokes onAuthenticationRequired once when status is AUTHENTICATION_REQUIRED.
 */
export async function pollPaymentUntilAuthorized(
  requestId: string,
  onAuthenticationRequired?: (redirectUrl: string) => void,
  options?: PollOptions & { shouldAbort?: () => boolean },
): Promise<PaymentAuthorizedResult> {
  const { intervalMs, maxAttempts, shouldAbort } = { ...PAYMENT_STATUS_POLL, ...options };
  let authWebViewShown = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (shouldAbort?.()) {
      throw new PaymentAbortedError();
    }

    if (attempt > 0) await sleep(intervalMs);

    if (shouldAbort?.()) {
      throw new PaymentAbortedError();
    }

    const payment = await getPaymentStatus(requestId);
    const status = normalizePaymentStatus(payment.status);

    switch (status) {
      case 'FAILED':
        throw new PaymentFailedError(payment.failureReason ?? payment.message);
      case 'AUTHORIZED':
        return {
          offerId: payment.offerId,
          paymentIntentId: payment.paymentIntentId,
        };
      case 'AUTHENTICATION_REQUIRED':
        if (payment.redirectUrl && !authWebViewShown) {
          authWebViewShown = true;
          onAuthenticationRequired?.(payment.redirectUrl);
        }
        break;
      case 'PROCESSING':
      default:
        break;
    }
  }

  throw new PaymentStatusTimeoutError();
}
