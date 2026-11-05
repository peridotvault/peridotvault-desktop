import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { API_BASE } from '@shared/constants/storage';

export interface VerifyRequest {
  signature: string;
  message: string;
  accountId: string;
  accountType: 'evm' | 'solana' | 'icp' | string;
}

export interface VerifyUser {
  id: string;
  username: string;
  email: string;
  profile_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerifyAccount {
  id: number;
  user_id: string;
  account_id: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  account_types: {
    id: number;
    curve_id: number;
    code: string;
  };
}

export interface VerifyData {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: VerifyUser;
  account: VerifyAccount;
  accounts: VerifyAccount[];
}

export interface VerifyResponse {
  success: boolean;
  data?: VerifyData;
  error?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshData {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshResponse {
  success: boolean;
  data?: RefreshData;
  error?: string;
}

/**
 * Verify wallet signature and get JWT token.
 * This is the main authentication endpoint.
 * Note: This uses raw fetch (not http client) since it doesn't need auth token.
 */
export async function verifyAuth(payload: VerifyRequest): Promise<VerifyResponse> {
  const url = `${API_BASE}/api/auth/verify`;
  
  console.log('[AuthAPI] Verifying authentication:', { 
    accountId: payload.accountId, 
    accountType: payload.accountType,
    messageLength: payload.message.length,
    signatureLength: payload.signature.length,
    signaturePrefix: payload.signature.substring(0, 20) + '...',
  });

  try {
    const response = await tauriFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[AuthAPI] Response status:', response.status);

    const json = await response.json();
    console.log('[AuthAPI] Response body:', json);

    // Handle success (2xx status codes)
    if (response.ok) {
      // Check if response has the expected structure
      // API might return { data: { token, refreshToken, ... } } or { token, refreshToken, ... }
      const data = json.data ?? json;
      
      // Verify we have the required fields
      if (data.token && data.refreshToken && data.expiresAt) {
        console.log('[AuthAPI] Verification successful');
        return {
          success: true,
          data: {
            token: data.token,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            user: data.user,
            account: data.account,
            accounts: data.accounts,
          },
        };
      }
      
      // If we don't have the expected fields, log and return error
      console.error('[AuthAPI] Response missing required fields:', data);
      return {
        success: false,
        error: 'Invalid response format from server',
      };
    }

    // Handle error response
    let message = 'Failed to authenticate';
    
    if (typeof json.message === 'string') {
      message = json.message;
    } else if (Array.isArray(json.message)) {
      message = json.message.join('; ');
    } else if (json.error) {
      message = json.error;
    }

    console.error('[AuthAPI] Error response:', message);
    return {
      success: false,
      error: message,
    };
  } catch (error) {
    console.error('[AuthAPI] Verification failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

/**
 * Refresh JWT token using refresh token.
 * Note: This uses raw fetch (not http client) since it uses refresh token instead.
 */
export async function refreshAuthToken(refreshToken: string): Promise<RefreshData> {
  const url = `${API_BASE}/api/auth/refresh`;
  console.log('[AuthAPI] Refreshing token');

  const response = await tauriFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.ok) {
    const json = await response.json();
    const data = json.data ?? json;
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'REFRESH_FAILED');
    }
    
    console.log('[AuthAPI] Token refreshed successfully');
    return data.data;
  }

  // Handle error
  let message = 'Failed to refresh token';
  try {
    const errorData = await response.json();
    message = errorData.message || errorData.error || message;
  } catch {
    message = `Request failed: ${response.status} ${response.statusText}`;
  }
  
  throw new Error(message);
}

/**
 * Get user profile (requires authentication).
 * Note: This uses the http client which will handle auth headers.
 */
export async function getAuthProfile(): Promise<VerifyUser> {
  // Import http dynamically to avoid circular dependency
  const { http } = await import('@shared/lib/http');
  console.log('[AuthAPI] Fetching profile');
  return http.get<VerifyUser>('/api/auth/profile');
}
