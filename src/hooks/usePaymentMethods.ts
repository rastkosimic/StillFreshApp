import { useCallback, useMemo, useState } from 'react';

import {
  deleteAllSecurePaymentMethod,
  getAllSecurePaymentMethods,
  hasDefaultCard,
} from '@/services/allSecurePaymentService';
import { AllSecurePaymentMethod } from '@/types';

interface UsePaymentMethodsResult {
  methods: AllSecurePaymentMethod[];
  isLoading: boolean;
  error: string | null;
  hasDefaultCard: boolean;
  refresh: () => Promise<void>;
  deleteMethod: (paymentMethodId: string) => Promise<void>;
}

export function usePaymentMethods(): UsePaymentMethodsResult {
  const [methods, setMethods] = useState<AllSecurePaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllSecurePaymentMethods();
      setMethods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteMethod = useCallback(async (paymentMethodId: string) => {
    await deleteAllSecurePaymentMethod(paymentMethodId);
    setMethods((prev) => prev.filter((m) => m.paymentMethodId !== paymentMethodId));
  }, []);

  const defaultCardExists = useMemo(() => hasDefaultCard(methods), [methods]);

  return {
    methods,
    isLoading,
    error,
    hasDefaultCard: defaultCardExists,
    refresh,
    deleteMethod,
  };
}
