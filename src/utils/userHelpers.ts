import { User } from '@/types';

function isBlank(value?: string | null): boolean {
  return value == null || value.trim() === '';
}

/** Display name: firstName + lastName, then name, then username, then email. */
export function getUserDisplayName(user: User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.name?.trim()) return user.name.trim();
  if (user.username?.trim()) return user.username.trim();
  return user.email;
}

/** Initials for avatar placeholder (up to 2 characters). */
export function getUserInitials(user: User): string {
  const displayName = getUserDisplayName(user);
  if (displayName === user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** True when phone, address, or dietary preference is still empty. */
export function isProfileIncomplete(user: User): boolean {
  const phone = user.phoneNumber ?? user.phone;
  return isBlank(phone) || isBlank(user.address) || isBlank(user.dietaryPreference);
}

/** Returns trimmed value or undefined when blank. */
export function normalizeOptionalField(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const BIRTHDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBirthday(value: string): boolean {
  if (value.trim() === '') return true;
  if (!BIRTHDAY_PATTERN.test(value.trim())) return false;
  const date = new Date(`${value.trim()}T00:00:00`);
  return !Number.isNaN(date.getTime());
}
