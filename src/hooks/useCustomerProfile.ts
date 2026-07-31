import { useCallback, useState } from 'react';

import {
  getProfile,
  updateAddress,
  updateBirthday,
  updateCountry,
  updateDietaryPreference,
  updateName,
  updatePhone,
} from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@/types';

export type ProfileFieldKey =
  | 'name'
  | 'phone'
  | 'address'
  | 'country'
  | 'birthday'
  | 'dietaryPreference';

function mergeWithSession(profile: User, sessionUser: User | null): User {
  if (sessionUser == null) return profile;
  return {
    ...sessionUser,
    ...profile,
    role: sessionUser.role,
    vendor: sessionUser.vendor ?? profile.vendor,
  };
}

const PROFILE_SYNC_FIELDS: Array<keyof User> = [
  'email',
  'username',
  'firstName',
  'lastName',
  'name',
  'phone',
  'phoneNumber',
  'address',
  'country',
  'countryCode',
  'birthday',
  'dietaryPreference',
  'profileCompleted',
  'status',
];

function profilesEqual(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;

  return PROFILE_SYNC_FIELDS.every((field) => a[field] === b[field]);
}

export function useCustomerProfile() {
  const sessionUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState<User | null>(sessionUser);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<ProfileFieldKey | null>(null);

  const applyProfile = useCallback(
    async (nextProfile: User) => {
      const sessionSnapshot = useAuthStore.getState().user;
      const merged = mergeWithSession(nextProfile, sessionSnapshot);
      setProfile(merged);
      if (!profilesEqual(merged, sessionSnapshot)) {
        await setUser(merged);
      }
    },
    [setUser],
  );

  const loadProfile = useCallback(
    async (silent = false) => {
      const sessionSnapshot = useAuthStore.getState().user;
      if (sessionSnapshot == null) {
        if (!silent) setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      setError(null);

      try {
        const fetched = await getProfile();
        await applyProfile(fetched);
      } catch {
        setError('errors.serverError');
        setProfile(sessionSnapshot);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [applyProfile],
  );

  const refreshProfile = useCallback(async () => {
    setIsRefreshing(true);
    await loadProfile(true);
    setIsRefreshing(false);
  }, [loadProfile]);

  const updateField = useCallback(
    async (field: ProfileFieldKey, values: Record<string, string>) => {
      setSavingField(field);
      setError(null);

      try {
        let updated: User;
        switch (field) {
          case 'name':
            updated = await updateName({
              firstName: values.firstName,
              lastName: values.lastName,
            });
            break;
          case 'phone':
            updated = await updatePhone({ phoneNumber: values.phoneNumber });
            break;
          case 'address':
            updated = await updateAddress({ address: values.address });
            break;
          case 'country':
            updated = await updateCountry({ country: values.country });
            break;
          case 'birthday':
            updated = await updateBirthday({ birthday: values.birthday });
            break;
          case 'dietaryPreference':
            updated = await updateDietaryPreference({
              dietaryPreference: values.dietaryPreference,
            });
            break;
        default:
          throw new Error(`Unsupported profile field: ${String(field)}`);
        }

        await applyProfile(updated);
        return true;
      } catch {
        setError('errors.serverError');
        return false;
      } finally {
        setSavingField(null);
      }
    },
    [applyProfile],
  );

  return {
    profile: profile ?? sessionUser,
    isLoading,
    isRefreshing,
    error,
    savingField,
    loadProfile,
    refreshProfile,
    updateField,
    clearError: () => setError(null),
  };
}
