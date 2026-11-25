import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import {
  createVendorProduct,
  deleteVendorProduct,
  getVendorProducts,
  renameVendorProduct,
} from '@/services/vendorProductService';
import { VendorProduct } from '@/types';
import { sortProductsByName } from '@/utils/offerItems';

interface UseVendorProductsResult {
  products: VendorProduct[];
  isLoading: boolean;
  /** True once the list has been fetched successfully at least once. */
  hasLoaded: boolean;
  /** True when the most recent fetch failed. */
  loadFailed: boolean;
  refresh: () => Promise<void>;
  addProduct: (name: string) => Promise<VendorProduct>;
  renameProduct: (productId: number, name: string) => Promise<VendorProduct>;
  removeProduct: (productId: number) => Promise<void>;
}

/**
 * The signed-in location's product list. Reloads whenever the screen regains focus, so the
 * offer form sees products added on the "My products" screen as soon as the vendor comes back.
 * Mutations throw the service error; the caller decides how to show it.
 */
export function useVendorProducts(): UseVendorProductsResult {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVendorProducts();
      setProducts(sortProductsByName(data));
      setHasLoaded(true);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const addProduct = useCallback(async (name: string) => {
    const created = await createVendorProduct(name);
    setProducts((prev) => sortProductsByName([...prev, created]));
    return created;
  }, []);

  const renameProduct = useCallback(async (productId: number, name: string) => {
    const updated = await renameVendorProduct(productId, name);
    setProducts((prev) =>
      sortProductsByName(prev.map((p) => (p.id === productId ? updated : p))),
    );
    return updated;
  }, []);

  const removeProduct = useCallback(async (productId: number) => {
    await deleteVendorProduct(productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  return {
    products,
    isLoading,
    hasLoaded,
    loadFailed,
    refresh,
    addProduct,
    renameProduct,
    removeProduct,
  };
}
