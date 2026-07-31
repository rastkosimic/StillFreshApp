import { API_BASE_URL } from '@/config/api';

export function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/https?:\/\/localhost(:\d+)?/, API_BASE_URL);
}
