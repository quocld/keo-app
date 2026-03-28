/** Matches Postman `{{baseUrl}}` (includes `/api/v1`). */
export const DEFAULT_API_BASE = 'https://keo-be-production.up.railway.app/api/v1';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '').trim();
  return fromEnv || DEFAULT_API_BASE;
}
