/**
 * Storage configuration constants
 * These values can be overridden via environment variables
 */

// Base URL for the API
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? 'https://api.peridotvault.com';

// Storage base path for assets (images, files, etc.)
export const STORAGE_BASE_PATH =
  import.meta.env.VITE_STORAGE_BASE_PATH ?? '/storage/files';

// Full storage URL for accessing stored files
export const STORAGE_URL = `${API_BASE}${STORAGE_BASE_PATH}`;

// RPC URLs - Primary RPC for backward compatibility
export const EVM_RPC_URL =
  import.meta.env.VITE_EVM_RPC_URL ??
  import.meta.env.VITE_RPC_URL_BASE_TESTNET ??
  'https://base-sepolia.g.alchemy.com/v2/demo';

// Primary SVM RPC URL (backward compatibility)
export const SVM_RPC_URL =
  import.meta.env.VITE_SVM_RPC_URL ??
  import.meta.env.VITE_RPC_URL_SOLANA_TESTNET ??
  'https://api.devnet.solana.com';

// Multiple SVM RPC URLs with fallback support
export const SVM_RPC_URLS: string[] = [
  import.meta.env.VITE_SVM_RPC_URL ??
  import.meta.env.VITE_RPC_URL_SOLANA_TESTNET ??
  'https://devnet.helius-rpc.com/?api-key=647e5f6c-1ec1-4999-89d8-794d3f34f433',
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
];

// Contract addresses
export const EVM_REGISTRY_ADDRESS =
  import.meta.env.VITE_EVM_REGISTRY_ADDRESS ??
  import.meta.env.VITE_REGISTRY_ADDRESS_BASE_TESTNET ??
  '0x2091278674cec58296f4e7b868c2c84f5942abad';

export const SVM_PGC1_PROGRAM_ID =
  import.meta.env.VITE_SVM_PGC1_PROGRAM_ID ??
  import.meta.env.VITE_PGC1_ADDRESS_SOLANA_TESTNET ??
  'DzDbFZXZsmFFv1mMFimLaBjAQi7Z5gUaQ61qcDuR6Kor';
