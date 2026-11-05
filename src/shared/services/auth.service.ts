import { appDb } from '@core/storage/storage.db';
import type { VerifyData, RefreshData } from '../api/auth.api';

const AUTH_SESSION_KEY = 'auth_session';

export interface AuthSession {
  token: string;
  refreshToken: string;
  expiresAt: string;
  accountId: string;
  accountType: string;
  updatedAt: number;
}

/**
 * Get stored auth session from KV store.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const record = await appDb.kv.get(AUTH_SESSION_KEY);
    if (!record) return null;
    return record.value as AuthSession;
  } catch (error) {
    console.error('[AuthService] Failed to get session:', error);
    return null;
  }
}

/**
 * Save auth session to KV store.
 */
export async function setAuthSession(
  data: VerifyData | RefreshData,
  accountId: string,
  accountType: string
): Promise<AuthSession> {
  const session: AuthSession = {
    token: data.token,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    accountId,
    accountType,
    updatedAt: Date.now(),
  };

  await appDb.kv.put({
    key: AUTH_SESSION_KEY,
    value: session as any,
    updatedAt: Date.now(),
  });

  console.log('[AuthService] Session saved');
  return session;
}

/**
 * Update just the token and refresh token.
 */
export async function updateAuthToken(data: RefreshData): Promise<void> {
  const current = await getAuthSession();
  if (!current) {
    throw new Error('No existing session to update');
  }

  const updated: AuthSession = {
    ...current,
    token: data.token,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    updatedAt: Date.now(),
  };

  await appDb.kv.put({
    key: AUTH_SESSION_KEY,
    value: updated as any,
    updatedAt: Date.now(),
  });

  console.log('[AuthService] Token updated');
}

/**
 * Clear auth session (logout).
 */
export async function clearAuthSession(): Promise<void> {
  await appDb.kv.delete(AUTH_SESSION_KEY);
  console.log('[AuthService] Session cleared');
}

/**
 * Check if token is expired.
 */
export function isTokenExpired(expiresAt: string): boolean {
  const expiryDate = new Date(expiresAt);
  // Consider token expired 5 minutes before actual expiry
  return expiryDate.getTime() - 5 * 60 * 1000 < Date.now();
}

/**
 * Get valid auth token.
 * Returns null if no session or token is expired.
 */
export async function getValidAuthToken(): Promise<string | null> {
  const session = await getAuthSession();
  if (!session) return null;

  if (isTokenExpired(session.expiresAt)) {
    console.log('[AuthService] Token expired');
    return null;
  }

  return session.token;
}

/**
 * Get auth headers for API requests.
 * Returns headers object with Authorization if token is valid.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getValidAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}
