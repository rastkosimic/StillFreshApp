import { LoginResponse } from '@/services/authService';
import { getOnboardingStatus, getVendorProfile } from '@/services/vendorService';
import { User, VendorInfo } from '@/types';

/**
 * Locations created by headquarters are fully provisioned (profile, address, chain
 * membership, banking model). They must not walk the HQ onboarding wizard — payment
 * setup (INDIVIDUAL only) happens later from the dashboard.
 */
function isProvisionedChainBranch(status: {
  isChainLocation?: boolean;
  isHeadquarters?: boolean;
  status?: string;
}): boolean {
  if (status.isChainLocation !== true || status.isHeadquarters === true) {
    return false;
  }
  return status.status !== 'PENDING_VERIFICATION';
}

export async function completeVendorAuth(response: LoginResponse): Promise<User> {
  const sessionUser = response.user;
  const vendorId = response.vendor?.id ?? sessionUser.id;

  const onboarding = await getOnboardingStatus();
  const vendorProfile = await getVendorProfile(vendorId);

  const vendor: VendorInfo = response.vendor ?? {
    id: vendorProfile.id,
    isHeadquarters: vendorProfile.isHeadquarters,
    isChainLocation: vendorProfile.isChainLocation,
    chainName: vendorProfile.chainName,
  };

  const profileCompleted =
    onboarding.status === 'COMPLETED' || isProvisionedChainBranch(onboarding);

  return {
    ...sessionUser,
    id: vendorProfile.id,
    email: vendorProfile.email ?? sessionUser.email,
    username: vendorProfile.username ?? sessionUser.username,
    phone: vendorProfile.phone ?? sessionUser.phone,
    phoneNumber: vendorProfile.phone ?? sessionUser.phoneNumber,
    address: vendorProfile.address ?? sessionUser.address,
    role: sessionUser.role,
    vendor: {
      ...vendor,
      isHeadquarters: onboarding.isHeadquarters ?? vendor.isHeadquarters,
      isChainLocation: onboarding.isChainLocation ?? vendor.isChainLocation,
      chainName: onboarding.chainName || vendor.chainName,
    },
    profileCompleted,
  };
}
