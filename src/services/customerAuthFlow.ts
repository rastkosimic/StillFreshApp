import { LoginResponse } from '@/services/authService';
import { loadCustomerProfileAfterAuth } from '@/services/userService';
import { User } from '@/types';

export async function completeCustomerAuth(
  response: LoginResponse,
): Promise<User> {
  return loadCustomerProfileAfterAuth(response.user);
}
