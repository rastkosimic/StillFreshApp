export type UserRole = 'USER' | 'VENDOR' | 'VENDOR_ADMIN';

export interface VendorInfo {
  id: number;
  isHeadquarters: boolean;
  isChainLocation: boolean;
  chainName?: string;
  locationId?: number;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface User {
  id: number | string;
  email: string;
  username?: string;
  // The API returns both naming conventions in different contexts; both are optional
  // to allow normalization via userService.normalizeUser()
  firstName?: string;
  lastName?: string;
  name?: string;
  role: UserRole;
  status?: UserStatus;
  profileCompleted?: boolean;
  // Phone field — API returns both 'phone' and 'phoneNumber' in different contexts
  phone?: string;
  phoneNumber?: string;
  address?: string;
  country?: string;
  countryCode?: string;
  birthday?: string;
  dietaryPreference?: string;
  vendor?: VendorInfo;
}

/**
 * A staff login for exactly one location. Workers share the vendor table with locations;
 * the distinguishing field is `assignedLocationId`, never the role alone.
 */
export interface Worker {
  id: number;
  username: string;
  email: string;
  phone?: string;
  role?: 'VENDOR';
  assignedLocationId?: number;
  locationName?: string;
  status: UserStatus;
}

export interface WorkerRequest {
  username: string;
  email: string;
  password: string;
  phone?: string;
}

/** Absent fields are left unchanged by the server, so send only what the admin edited. */
export interface WorkerUpdateRequest {
  username?: string;
  phone?: string;
  /** Headquarters only — moves the worker to another location of the same chain. */
  assignedLocationId?: number;
}
