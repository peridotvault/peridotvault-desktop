import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { API_BASE } from '@shared/constants/storage';
import { getValidAuthToken } from '@shared/services/auth.service';

export type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Purchase {
  id: number;
  gameId: string;
  userId: number;
  purchasePrice: string;
  paymentToken: string;
  paymentTokenId: number;
  transactionHash: string;
  status: PurchaseStatus;
  purchasedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseStats {
  gameId: string;
  totalPurchases: number;
  totalRevenue: string;
  uniqueBuyers: number;
}

export interface CreatePurchaseRequest {
  gameId: string;
  purchasePrice: string;
  paymentToken: string;
  paymentTokenId: number;
  transactionHash: string;
}

export interface CompletePurchaseRequest {
  gameId: string;
  transactionHash: string;
}

export interface GetPurchasesQuery {
  q?: string;
  status?: PurchaseStatus;
  sort?: 'purchased_at_desc' | 'purchased_at_asc' | 'price_desc' | 'price_asc';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPurchasesResponse {
  data: Purchase[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (res.ok) {
    const json = await res.json();
    return json.data ?? json;
  }

  let message = 'Failed to process purchase request';
  try {
    const errorData = await res.json();
    if (typeof errorData.message === 'string') {
      message = errorData.message;
    } else if (Array.isArray(errorData.message)) {
      message = errorData.message.join('; ');
    } else if (errorData.error) {
      message = errorData.error;
    }
  } catch {
    message = `Request failed: ${res.status} ${res.statusText}`;
  }

  const error = new Error(message);
  (error as any).statusCode = res.status;
  throw error;
};

/**
 * Create a purchase record with pending status.
 * Called after payment initiation.
 */
export async function createPurchase(
  request: CreatePurchaseRequest,
): Promise<Purchase> {
  const url = `${API_BASE}/api/purchases`;
  console.log('[PurchaseAPI] Creating purchase:', { gameId: request.gameId });

  // Get auth token if available
  const token = await getValidAuthToken();
  const headers: Record<string, string> = {
    accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await tauriFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleResponse<Purchase>(response);
}

/**
 * Get all purchases made by the authenticated user.
 * Supports search by game name, filter by status, date range, sort, and pagination.
 */
export async function getMyPurchases(
  query: GetPurchasesQuery = {},
): Promise<PaginatedPurchasesResponse> {
  const params = new URLSearchParams();

  if (query.q) params.append('q', query.q);
  if (query.status) params.append('status', query.status);
  if (query.sort) params.append('sort', query.sort);
  if (query.dateFrom) params.append('date_from', query.dateFrom);
  if (query.dateTo) params.append('date_to', query.dateTo);
  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());

  const url = `${API_BASE}/api/purchases?${params.toString()}`;
  console.log('[PurchaseAPI] Fetching purchases:', { query });

  // Get auth token if available
  const token = await getValidAuthToken();
  const headers: Record<string, string> = {
    accept: '*/*',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await tauriFetch(url, {
    method: 'GET',
    headers,
  });

  return handleResponse<PaginatedPurchasesResponse>(response);
}

/**
 * Update purchase status to completed.
 * Called when payment is confirmed on-chain.
 */
export async function completePurchase(
  gameId: string,
  request: CompletePurchaseRequest,
): Promise<Purchase> {
  const url = `${API_BASE}/api/purchases/${encodeURIComponent(gameId)}/complete`;
  console.log('[PurchaseAPI] Completing purchase:', { gameId });

  // Get auth token if available
  const token = await getValidAuthToken();
  const headers: Record<string, string> = {
    accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await tauriFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(request),
  });

  return handleResponse<Purchase>(response);
}

/**
 * Get purchase record for a specific game if user has purchased it.
 */
export async function getPurchaseByGameId(
  gameId: string,
): Promise<Purchase | null> {
  const url = `${API_BASE}/api/purchases/${encodeURIComponent(gameId)}`;
  console.log('[PurchaseAPI] Fetching purchase by gameId:', { gameId });

  try {
    // Get auth token if available
    const token = await getValidAuthToken();
    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await tauriFetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    return handleResponse<Purchase>(response);
  } catch (error) {
    console.error('[PurchaseAPI] Failed to fetch purchase:', error);
    return null;
  }
}

/**
 * Check if user has purchased a specific game.
 */
export async function hasPurchasedGame(gameId: string): Promise<boolean> {
  const purchase = await getPurchaseByGameId(gameId);
  return purchase !== null && purchase.status === 'completed';
}

/**
 * Get purchase stats for a game (for owners/developers).
 */
export async function getPurchaseStats(
  gameId: string,
): Promise<PurchaseStats | null> {
  const url = `${API_BASE}/api/purchases/games/${encodeURIComponent(gameId)}/stats`;
  console.log('[PurchaseAPI] Fetching purchase stats:', { gameId });

  try {
    // Get auth token if available
    const token = await getValidAuthToken();
    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await tauriFetch(url, {
      method: 'GET',
      headers,
    });

    return handleResponse<PurchaseStats>(response);
  } catch (error) {
    console.error('[PurchaseAPI] Failed to fetch purchase stats:', error);
    return null;
  }
}
