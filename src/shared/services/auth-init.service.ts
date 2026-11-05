import { verifyAuth } from '../api/auth.api';
import {
  setAuthSession,
  getValidAuthToken,
  getAuthSession,
  isTokenExpired,
  clearAuthSession,
} from './auth.service';
import { signMessageWithEvm, deriveEvmAddressFromSeed } from '../utils/evm';
import { useWalletLockStore } from '../states/wallet-lock.store';
import { libraryService } from '@features/library/services/localDb';
import { useLibraryStore } from '@features/library/hooks/useLibraryStore';

// Track auth attempts to prevent infinite loops
const authAttemptCache = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 3;
const AUTH_COOLDOWN_MS = 30000; // 30 seconds cooldown between attempts

// Validate that the seed phrase is a proper BIP39 mnemonic
function isValidSeedPhrase(seedPhrase: string): boolean {
  if (!seedPhrase || typeof seedPhrase !== 'string') return false;
  const words = seedPhrase.trim().split(/\s+/);
  const validCounts = [12, 15, 18, 21, 24];
  return validCounts.includes(words.length);
}

/**
 * Get cache key for a seed phrase (hash of first/last words)
 */
function getSeedPhraseCacheKey(seedPhrase: string): string {
  const words = seedPhrase.trim().split(/\s+/);
  return `${words[0]}_${words[words.length - 1]}_${words.length}`;
}

/**
 * Check if we should attempt auth based on retry limits
 */
function shouldAttemptAuth(seedPhrase: string): { shouldAttempt: boolean; message?: string } {
  const key = getSeedPhraseCacheKey(seedPhrase);
  const now = Date.now();
  const attemptData = authAttemptCache.get(key);

  if (!attemptData) {
    return { shouldAttempt: true };
  }

  const timeSinceLastAttempt = now - attemptData.lastAttempt;

  // If cooldown period has passed, reset counter
  if (timeSinceLastAttempt > AUTH_COOLDOWN_MS) {
    authAttemptCache.delete(key);
    return { shouldAttempt: true };
  }

  // If we've exceeded max attempts, don't retry yet
  if (attemptData.count >= MAX_AUTH_ATTEMPTS) {
    const remainingCooldown = Math.ceil((AUTH_COOLDOWN_MS - timeSinceLastAttempt) / 1000);
    return {
      shouldAttempt: false,
      message: `Too many auth attempts. Please wait ${remainingCooldown} seconds before retrying.`,
    };
  }

  return { shouldAttempt: true };
}

/**
 * Record an auth attempt
 */
function recordAuthAttempt(seedPhrase: string, success: boolean): void {
  const key = getSeedPhraseCacheKey(seedPhrase);
  const now = Date.now();
  const existing = authAttemptCache.get(key);

  if (success) {
    // Clear cache on success
    authAttemptCache.delete(key);
  } else {
    authAttemptCache.set(key, {
      count: (existing?.count ?? 0) + 1,
      lastAttempt: now,
    });
  }
}

/**
 * Initialize authentication with the backend.
 * This should be called when the wallet is unlocked.
 *
 * @param seedPhrase - The wallet seed phrase (must be valid BIP39 mnemonic)
 * @returns true if authentication is successful or already valid
 */
export async function initializeAuth(seedPhrase: string): Promise<boolean> {
  try {
    // Validate seed phrase first
    if (!isValidSeedPhrase(seedPhrase)) {
      console.warn(
        '[AuthInit] Invalid seed phrase provided. Expected 12, 15, 18, 21, or 24 words.',
      );
      return false;
    }

    // Check if we already have a valid token
    const existingToken = await getValidAuthToken();
    if (existingToken) {
      console.log('[AuthInit] Using existing valid auth token');
      return true;
    }

    // Check if we have a session that needs refresh
    const session = await getAuthSession();
    if (session && !isTokenExpired(session.expiresAt)) {
      console.log('[AuthInit] Existing session is valid');
      return true;
    }

    // Check retry limits
    const attemptCheck = shouldAttemptAuth(seedPhrase);
    if (!attemptCheck.shouldAttempt) {
      console.warn('[AuthInit]', attemptCheck.message);
      return false;
    }

    // Need to authenticate - sign a message
    console.log('[AuthInit] Authenticating with backend...');
    const evmAddress = deriveEvmAddressFromSeed(seedPhrase);

    // Use a simpler message format without timestamp to avoid timing issues
    // The server should verify the signature against the address
    const message = `Sign this message to authenticate with PeridotVault`;

    console.log('[AuthInit] Derived address:', evmAddress);

    console.log('[AuthInit] Signing message with EVM wallet...');
    const signature = await signMessageWithEvm(message, seedPhrase);
    console.log('[AuthInit] Message signed, sending to backend...');

    const response = await verifyAuth({
      signature,
      message,
      accountId: evmAddress,
      accountType: 'evm',
    });

    if (response.success && response.data) {
      await setAuthSession(response.data, evmAddress, 'evm');
      recordAuthAttempt(seedPhrase, true);
      console.log('[AuthInit] Authentication successful');
      return true;
    } else {
      // Check if it's a server error (500) vs auth error
      const isServerError =
        response.error?.includes('500') || response.error?.includes('Internal server error');

      if (isServerError) {
        console.error('[AuthInit] Server error (500) - not locking wallet. Error:', response.error);
        // Don't record as failed attempt for server errors
        return false;
      }

      console.error('[AuthInit] Authentication failed:', response.error);
      recordAuthAttempt(seedPhrase, false);
      return false;
    }
  } catch (error) {
    console.error('[AuthInit] Authentication error:', error);
    recordAuthAttempt(seedPhrase, false);
    return false;
  }
}

/**
 * Initialize authentication with the backend.
 * If authentication fails with invalid credentials (not server errors),
 * this will lock the wallet and show the password prompt.
 * This should be called when the wallet is unlocked.
 *
 * @param seedPhrase - The wallet seed phrase (must be valid BIP39 mnemonic)
 * @returns true if authentication is successful or already valid
 */
export async function initializeAuthWithLockOnFailure(seedPhrase: string): Promise<boolean> {
  const success = await initializeAuth(seedPhrase);

  if (!success) {
    // Check if we should lock the wallet
    const attemptCheck = shouldAttemptAuth(seedPhrase);
    const attemptData = authAttemptCache.get(getSeedPhraseCacheKey(seedPhrase));

    // Only lock if we've exhausted retries or it's an auth error (not server error)
    if (attemptData && attemptData.count >= MAX_AUTH_ATTEMPTS) {
      console.warn('[AuthInit] Auth failed after max retries - locking wallet');
      // Clear any existing auth session
      await clearAuthSession();
      // Lock the wallet to show password prompt
      await useWalletLockStore.getState().forceLock();
    } else if (!attemptCheck.shouldAttempt) {
      // Cooldown period - don't lock, just wait
      console.warn('[AuthInit] Auth cooldown active - not locking wallet');
    } else {
      // Server error or other issue - don't lock, just skip API for now
      console.warn(
        '[AuthInit] Auth failed (server error or other issue) - not locking wallet, will use blockchain fallback',
      );
    }
  }

  return success;
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getValidAuthToken();
  return token !== null;
}

/**
 * Logout - clear authentication session and library data.
 */
export async function logout(): Promise<void> {
  // Clear auth session
  await clearAuthSession();

  // Clear library data from IndexedDB
  await libraryService.clear();

  // Reset library store state
  useLibraryStore.getState().clearAll();

  console.log('[AuthInit] Logged out and library data cleared');
}

/**
 * Reset auth attempt cache (for testing or manual retry)
 */
export function resetAuthAttempts(seedPhrase: string): void {
  const key = getSeedPhraseCacheKey(seedPhrase);
  authAttemptCache.delete(key);
  console.log('[AuthInit] Auth attempts reset');
}
