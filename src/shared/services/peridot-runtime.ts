import Dexie, { type Table } from 'dexie';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { walletService, type WalletGenerateSuccess } from '@shared/services/wallet';
import type {
  PeridotRuntimeKdfParams,
  PeridotRuntimeSecretRecord,
  PeridotRuntimeSeedRecord,
  PeridotRuntimeWalletData,
} from './peridot-runtime.types';

type RuntimeSeedRow = {
  id: 'default';
  encryption: 'aes-256-gcm';
  salt: string;
  kdfParams: PeridotRuntimeKdfParams;
  createdAt?: number;
  updatedAt: number;
};

type RuntimeSecretRow = {
  id: 'default';
  seedPhrase: string;
  iv: string;
  passwordVerifier: string;
  createdAt?: number;
};

type RuntimeAccountRow = {
  id?: number;
  kind: string;
  derivationPath: string;
  publicKey: string;
  privateKey: string;
  iv: string;
  createdAt?: number;
  updatedAt: number;
};

const DEFAULT_ID = 'default';
const RUNTIME_DB_NAME = 'peridotwallet';
const RUNTIME_SESSION_KEY = 'peridotwallet.session';

class PeridotRuntimeDb extends Dexie {
  seeds!: Table<RuntimeSeedRow, string>;
  secrets!: Table<RuntimeSecretRow, string>;
  accounts!: Table<RuntimeAccountRow, number>;

  constructor() {
    super(RUNTIME_DB_NAME);
    this.version(3).stores({
      accounts: '++id, kind, publicKey, updatedAt',
      secrets: 'id',
      seeds: 'id, updatedAt',
    });
  }
}

const runtimeDb = new PeridotRuntimeDb();

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const encodeBase64 = (value: Uint8Array): string => {
  let binary = '';

  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }

  return btoa(binary);
};

const deriveKeyBytes = async (
  password: string,
  salt: string,
  kdfParams: PeridotRuntimeKdfParams,
): Promise<Uint8Array> => {
  return await argon2idAsync(password, salt, {
    t: kdfParams.iterations,
    m: kdfParams.memoryKiB,
    p: kdfParams.parallelism,
    dkLen: 32,
  });
};

const deriveAesKey = async (
  password: string,
  salt: string,
  kdfParams: PeridotRuntimeKdfParams,
): Promise<CryptoKey> => {
  const keyBytes = await deriveKeyBytes(password, salt, kdfParams);

  return await crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
};

const toRuntimeSnapshot = (
  seed: RuntimeSeedRow,
  secret: RuntimeSecretRow,
): PeridotRuntimeWalletData => {
  const seedRecord: PeridotRuntimeSeedRecord = {
    salt: seed.salt,
    kdfParams: seed.kdfParams,
  };

  const secretRecord: PeridotRuntimeSecretRecord = {
    seedPhrase: secret.seedPhrase,
    iv: secret.iv,
    passwordVerifier: secret.passwordVerifier,
  };

  return {
    seed: seedRecord,
    secret: secretRecord,
    syncedAt: Date.now(),
  };
};

export const getPeridotRuntimeWallet = async (): Promise<PeridotRuntimeWalletData | null> => {
  const [seed, secret] = await Promise.all([
    runtimeDb.seeds.get(DEFAULT_ID),
    runtimeDb.secrets.get(DEFAULT_ID),
  ]);

  if (!seed || !secret) {
    return null;
  }

  return toRuntimeSnapshot(seed, secret);
};

export const hasPeridotRuntimeWallet = async (): Promise<boolean> => {
  return (await getPeridotRuntimeWallet()) !== null;
};

export const clearPeridotRuntimeWallet = async (): Promise<void> => {
  await Promise.all([
    runtimeDb.accounts.clear(),
    runtimeDb.seeds.clear(),
    runtimeDb.secrets.clear(),
  ]);

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(RUNTIME_SESSION_KEY);
  }
};

export const isPeridotRuntimePasswordMatch = async (
  runtimeWallet: PeridotRuntimeWalletData,
  password: string,
): Promise<boolean> => {
  const keyBytes = await deriveKeyBytes(
    password,
    runtimeWallet.seed.salt,
    runtimeWallet.seed.kdfParams,
  );

  return encodeBase64(keyBytes) === runtimeWallet.secret.passwordVerifier;
};

export const decryptPeridotRuntimeSeedPhrase = async (
  runtimeWallet: PeridotRuntimeWalletData,
  password: string,
): Promise<string> => {
  const aesKey = await deriveAesKey(
    password,
    runtimeWallet.seed.salt,
    runtimeWallet.seed.kdfParams,
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64(runtimeWallet.secret.iv) as any,
    },
    aesKey,
    decodeBase64(runtimeWallet.secret.seedPhrase) as any,
  );

  return new TextDecoder().decode(decrypted);
};

export const migratePeridotRuntimeWalletToDesktop = async (
  runtimeWallet: PeridotRuntimeWalletData,
  password: string,
): Promise<WalletGenerateSuccess> => {
  const isPasswordValid = await isPeridotRuntimePasswordMatch(runtimeWallet, password);

  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }

  const seedPhrase = await decryptPeridotRuntimeSeedPhrase(runtimeWallet, password);
  const result = await walletService.generateWallet(seedPhrase, password);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
};
