import apiClient from './apiClient';
import {
  AllSecurePaymentMethod,
  AllSecurePaymentStatusResponse,
  AllSecureRegisterResponse,
} from '@/types';

export async function registerCard(): Promise<AllSecureRegisterResponse> {
  const response = await apiClient.post<AllSecureRegisterResponse>(
    '/payment/allsecure/register-card',
    {},
  );
  return response.data;
}

function normalizePaymentMethod(raw: Record<string, unknown>): AllSecurePaymentMethod {
  const paymentMethodId = String(
    raw.paymentMethodId ?? raw.id ?? raw.referenceId ?? '',
  );
  return {
    paymentMethodId,
    type: 'card',
    isDefault: Boolean(raw.isDefault ?? raw.default ?? false),
    cardBrand: (raw.cardBrand ?? raw.brand) as string | undefined,
    cardLast4: (raw.cardLast4 ?? raw.last4) as string | undefined,
    cardExpMonth: (raw.cardExpMonth ?? raw.expMonth ?? raw.expiryMonth) as number | undefined,
    cardExpYear: (raw.cardExpYear ?? raw.expYear ?? raw.expiryYear) as number | undefined,
  };
}

export async function getAllSecurePaymentMethods(): Promise<AllSecurePaymentMethod[]> {
  const response = await apiClient.get<unknown>('/payment/allsecure/payment-methods');
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((item) => normalizePaymentMethod(item as Record<string, unknown>));
}

export async function deleteAllSecurePaymentMethod(paymentMethodId: string): Promise<void> {
  await apiClient.delete(`/payment/allsecure/payment-methods/${paymentMethodId}`);
}

export function hasDefaultCard(methods: AllSecurePaymentMethod[]): boolean {
  if (methods.length === 0) return false;
  return methods.some((m) => m.isDefault) || methods.length === 1;
}

export async function getPaymentStatus(
  requestId: string,
): Promise<AllSecurePaymentStatusResponse> {
  const response = await apiClient.get<AllSecurePaymentStatusResponse>(
    `/payment/allsecure/payment-status/${requestId}`,
  );
  return response.data;
}
