export type PeridotRuntimeKdfParams = {
  algorithm: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
};

export type PeridotRuntimeSeedRecord = {
  salt: string;
  kdfParams: PeridotRuntimeKdfParams;
};

export type PeridotRuntimeSecretRecord = {
  seedPhrase: string;
  iv: string;
  passwordVerifier: string;
};

export type PeridotRuntimeWalletData = {
  seed: PeridotRuntimeSeedRecord;
  secret: PeridotRuntimeSecretRecord;
  syncedAt: number;
};
