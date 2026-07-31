import { useCallback, useEffect, useState } from 'react';

import { getOnboardingStatus, getVendorProfile, VendorProfile } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { OnboardingStatus, UserRole } from '@/types';
import { handleInactiveAccount } from '@/utils/chainErrors';
import { decodeJWTPayload } from '@/utils/jwtDecoder';

export interface VendorIdentity {
  vendorId: number | null;
  role: UserRole | null;
  isAdmin: boolean;
  /** Standalone single-location vendor that may upgrade to a chain. */
  isUniqueVendor: boolean;
  /** Belongs to a chain, as either headquarters or a branch. */
  isChainLocation: boolean;
  /** Only headquarters may perform chain-wide actions. */
  isHeadquarters: boolean;
  chainName: string | null;
  locationName: string | null;
  onboardingStatus: OnboardingStatus | null;
  usesSharedPaymentAccount: boolean;
  profile: VendorProfile | null;
}

const EMPTY: VendorIdentity = {
  vendorId: null,
  role: null,
  isAdmin: false,
  isUniqueVendor: true,
  isChainLocation: false,
  isHeadquarters: false,
  chainName: null,
  locationName: null,
  onboardingStatus: null,
  usesSharedPaymentAccount: false,
  profile: null,
};

/**
 * Resolves the three flags that drive every chain-related UI branch, straight from the
 * server rather than from cached login state — an upgrade or a banking switch changes them
 * mid-session. Also mirrors the result back into the auth store so the dashboard's entry
 * points re-gate without a re-login.
 */
export function useVendorIdentity(): {
  identity: VendorIdentity;
  isLoading: boolean;
  refresh: () => Promise<VendorIdentity | null>;
} {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [identity, setIdentity] = useState<VendorIdentity>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<VendorIdentity | null> => {
    const token = useAuthStore.getState().token;
    const currentUser = useAuthStore.getState().user;
    if (currentUser == null || token == null) {
      setIsLoading(false);
      return null;
    }

    const payload = decodeJWTPayload(token);
    const vendorId =
      currentUser.vendor?.id ?? (payload?.userId as number | undefined) ?? Number(currentUser.id);

    try {
      const [status, profile] = await Promise.all([
        getOnboardingStatus(),
        getVendorProfile(vendorId),
      ]);

      // A null `isUniqueVendor` means a legacy standalone vendor; every other flag defaults
      // to false when absent.
      const isChainLocation = (status.isChainLocation ?? profile.isChainLocation) === true;
      const rawUnique = status.isUniqueVendor ?? profile.isUniqueVendor;
      const next: VendorIdentity = {
        vendorId,
        role: currentUser.role,
        isAdmin: currentUser.role === 'VENDOR_ADMIN',
        isUniqueVendor: rawUnique == null ? !isChainLocation : rawUnique === true,
        isChainLocation,
        isHeadquarters: (status.isHeadquarters ?? profile.isHeadquarters) === true,
        chainName: status.chainName || profile.chainName || null,
        locationName: profile.locationName ?? null,
        onboardingStatus: status.status ?? null,
        usesSharedPaymentAccount: status.usesSharedPaymentAccount === true,
        profile,
      };

      setIdentity(next);
      await setUser({
        ...currentUser,
        vendor: {
          id: vendorId,
          isHeadquarters: next.isHeadquarters,
          isChainLocation: next.isChainLocation,
          chainName: next.chainName ?? undefined,
          locationId: currentUser.vendor?.locationId,
        },
      });
      return next;
    } catch (error) {
      await handleInactiveAccount(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    void refresh();
    // Refresh is stable unless the auth user object identity changes.
  }, [refresh, user?.id]);

  return { identity, isLoading, refresh };
}
