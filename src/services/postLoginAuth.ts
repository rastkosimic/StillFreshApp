import { LoginResponse } from '@/services/authService';
import { completeCustomerAuth } from '@/services/customerAuthFlow';
import { completeVendorAuth } from '@/services/vendorAuthFlow';
import { User, UserRole } from '@/types';

function isVendorRole(role: UserRole): boolean {
  return role === 'VENDOR' || role === 'VENDOR_ADMIN';
}

export async function completeAuthAfterLogin(response: LoginResponse): Promise<User> {
  if (isVendorRole(response.user.role)) {
    return completeVendorAuth(response);
  }
  return completeCustomerAuth(response);
}
