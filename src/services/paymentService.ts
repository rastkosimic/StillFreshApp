import apiClient from './apiClient';
import { CustomerPaymentMethod } from '@/types';

// ── Customer Payment Methods ──────────────────────────────────────────────────

export async function getPaymentMethods(): Promise<CustomerPaymentMethod[]> {
  const response = await apiClient.get<CustomerPaymentMethod[]>('/customers/payment-methods');
  return response.data;
}

export async function registerCard(paymentMethodId: string): Promise<CustomerPaymentMethod> {
  const response = await apiClient.post<CustomerPaymentMethod>('/customers/payment-methods/card', {
    paymentMethodId,
  });
  return response.data;
}

export async function registerBankAccount(bankAccountToken: string): Promise<CustomerPaymentMethod> {
  const response = await apiClient.post<CustomerPaymentMethod>(
    '/customers/payment-methods/bank-account',
    { bankAccountToken },
  );
  return response.data;
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
  await apiClient.put(`/customers/payment-methods/${paymentMethodId}/default`);
}

export async function deletePaymentMethod(paymentMethodId: string): Promise<void> {
  await apiClient.delete(`/customers/payment-methods/${paymentMethodId}`);
}
