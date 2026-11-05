import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { API_BASE } from '@shared/constants/storage';
import {
  getValidAuthToken,
  getAuthSession,
  updateAuthToken,
  clearAuthSession,
} from '@shared/services/auth.service';
import { refreshAuthToken } from '@shared/api/auth.api';
import { useWalletLockStore } from '@shared/states/wallet-lock.store';

// Single-flight promise for token refresh
let refreshPromise: Promise<string> | null = null;

/**
 * Refresh token with single-flight pattern to prevent multiple simultaneous refresh requests.
 * If refresh fails, this will lock the wallet.
 */
async function refreshTokenSingleFlight(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const session = await getAuthSession();
    if (!session?.refreshToken) {
      throw new Error('NO_REFRESH_TOKEN');
    }

    const refreshed = await refreshAuthToken(session.refreshToken);
    await updateAuthToken(refreshed);
    console.log('[HTTP] Token refreshed successfully');

    return refreshed.token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
}

/**
 * HTTP client with automatic token refresh on 401 responses.
 * Similar to the web app's axios interceptor pattern.
 * 
 * If auth fails (401 and refresh fails), this will lock the wallet
 * to show the password prompt.
 */
export async function httpFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = 'GET', headers = {}, body } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  // Get auth token - this is required for all API calls
  const token = await getValidAuthToken();

  // If no token, we need to authenticate first
  if (!token) {
    console.log('[HTTP] No auth token available - locking wallet for authentication');
    await useWalletLockStore.getState().forceLock();
    throw new Error('AUTH_REQUIRED');
  }

  const requestHeaders: Record<string, string> = {
    accept: 'application/json',
    'Authorization': `Bearer ${token}`,
    ...headers,
  };

  if (body && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  console.log(`[HTTP] ${method} ${endpoint}`);

  const response = await tauriFetch(url, {
    method,
    headers: requestHeaders,
    body,
  });

  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401) {
    console.log('[HTTP] Received 401, attempting token refresh...');

    try {
      const newToken = await refreshTokenSingleFlight();

      // Retry the original request with new token
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await tauriFetch(url, {
        method,
        headers: requestHeaders,
        body,
      });

      if (retryResponse.ok) {
        const json = await retryResponse.json();
        return json.data ?? json;
      }

      // If retry still fails, lock wallet and throw
      console.error('[HTTP] Retry failed after token refresh - locking wallet');
      await clearAuthSession();
      await useWalletLockStore.getState().forceLock();
      throw new Error('Authentication failed after token refresh');
    } catch (refreshError) {
      // Refresh failed - lock wallet and clear session
      await clearAuthSession();
      await useWalletLockStore.getState().forceLock();
      console.error('[HTTP] Token refresh failed - wallet locked:', refreshError);
      throw new Error('Session expired. Please unlock wallet to authenticate.');
    }
  }

  // Handle response
  if (response.ok) {
    const json = await response.json();
    return json.data ?? json;
  }

  // Handle error response
  let message = 'Request failed';
  try {
    const errorData = await response.json();
    if (typeof errorData.message === 'string') {
      message = errorData.message;
    } else if (Array.isArray(errorData.message)) {
      message = errorData.message.join('; ');
    } else if (errorData.error) {
      message = errorData.error;
    }
  } catch {
    message = `Request failed: ${response.status} ${response.statusText}`;
  }

  const error = new Error(message);
  (error as any).statusCode = response.status;
  throw error;
}

/**
 * Convenience methods for common HTTP verbs.
 */
export const http = {
  get: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    httpFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    httpFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    httpFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    httpFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    httpFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};
