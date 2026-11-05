// wallet.ts
import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import { BIP32Factory } from 'bip32';
import { Buffer } from 'buffer';
import * as ecc from 'tiny-secp256k1';
import { EncryptedData, decryptString, encryptString } from '@shared/security/aes';
import { KV_KEYS } from '@shared/database/kv-keys';
import { getKvItem, setKvItem, deleteKvItem } from '../../core/storage/kv-key';
import type { PeridotRuntimeWalletData } from './peridot-runtime.types';

const bip32 = BIP32Factory(ecc);

export interface WalletData {
    encryptedSeedPhrase: EncryptedData | null;
    encryptedPrivateKey: EncryptedData | null;
    verificationData: EncryptedData | null;
    lock: OpenLockConfig | null;
    runtimeWallet: PeridotRuntimeWalletData | null;
}

export const hasRuntimeWalletData = (wallet: WalletData): boolean => Boolean(wallet.runtimeWallet);

export interface WalletGenerateSuccess {
    success: true;
    encryptedSeedPhrase: EncryptedData;
    encryptedPrivateKey: EncryptedData;
    verificationData: EncryptedData;
}

export interface WalletGenerateError {
    success: false;
    error: string;
}

export interface AESEncrypted {
    iv: string;
    encryptedData: string;
}

export interface OpenLockConfig {
    expiresAt: number;
    encryptedPassword: AESEncrypted;
}

// Get encryption key from environment variable
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
}

async function encryptPassword(password: string): Promise<AESEncrypted> {
    try {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(ENCRYPTION_KEY),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey'],
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode('salt'),
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt'],
        );

        const encodedPassword = new TextEncoder().encode(password);
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            key,
            encodedPassword,
        );

        return {
            iv: Buffer.from(iv).toString('base64'),
            encryptedData: Buffer.from(encryptedData).toString('base64'),
        };
    } catch (error) {
        console.error('Error encrypting password:', error);
        throw new Error('Failed to encrypt password');
    }
}

async function decryptPassword(encrypted: AESEncrypted): Promise<string> {
    try {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(ENCRYPTION_KEY),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey'],
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode('salt'),
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt'],
        );

        const iv = Buffer.from(encrypted.iv, 'base64');
        const encryptedData = Buffer.from(encrypted.encryptedData, 'base64');

        const decryptedData = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            key,
            encryptedData,
        );

        return new TextDecoder().decode(decryptedData);
    } catch (error) {
        console.error('Error decrypting password:', error);
        throw new Error('Failed to decrypt password');
    }
}

export type WalletGenerateResult = WalletGenerateSuccess | WalletGenerateError;

class WalletService {
    async generateWallet(seedPhrase: string, password: string): Promise<WalletGenerateResult> {
        try {
            const seed = mnemonicToSeedSync(seedPhrase);
            const root = bip32.fromSeed(seed);
            const child = root.derivePath("m/44'/60'/0'/0/0"); // EVM path

            if (!child.privateKey) {
                throw new Error('Private key is undefined');
            }

            const privateKey = Buffer.from(child.privateKey).toString('hex');

            const verificationData = await encryptString('VERIFY', password);
            const encryptedSeedPhrase = await encryptString(seedPhrase, password);
            const encryptedPrivateKey = await encryptString(privateKey, password);

            return {
                success: true,
                encryptedSeedPhrase,
                encryptedPrivateKey,
                verificationData,
            };
        } catch (error) {
            console.error('Wallet generation error:', error);
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }

    async openLock(
        password: string,
        verificationData: EncryptedData,
        minutes: number = 30,
    ): Promise<OpenLockConfig> {
        try {
            try {
                const decrypted = await decryptString(verificationData, password);
                if (decrypted !== 'VERIFY') {
                    throw new Error('Invalid password');
                }
            } catch (error) {
                throw new Error('Invalid password');
            }

            const encryptedPassword = await encryptPassword(password);

            const lock: OpenLockConfig = {
                expiresAt: Date.now() + minutes * 60 * 1000,
                encryptedPassword: encryptedPassword,
            };

            await setKvItem(KV_KEYS.walletLock, lock);

            return lock;
        } catch (error) {
            throw new Error('Failed to open lock: ' + (error as Error).message);
        }
    }

    async decryptWalletData(encryptedData: EncryptedData, password?: string): Promise<string> {
        try {
            const lock = await getKvItem<OpenLockConfig>(KV_KEYS.walletLock);
            if ((await this.isLockOpen()) && lock?.encryptedPassword) {
                const decryptedPassword = await decryptPassword(lock.encryptedPassword);
                return await decryptString(encryptedData, decryptedPassword);
            } else if (!password) {
                throw new Error('Password required when lock is not open');
            }
            return await decryptString(encryptedData, password);
        } catch (error) {
            throw new Error('Decryption error:' + (error as Error).message);
        }
    }

    async isLockOpen(): Promise<Boolean> {
        const lock = await getKvItem<OpenLockConfig>(KV_KEYS.walletLock);
        return !!(lock && Date.now() <= lock.expiresAt);
    }

    async closeLock(): Promise<Boolean> {
        await deleteKvItem(KV_KEYS.walletLock);
        return true;
    }

    async setLock(lock: OpenLockConfig | null): Promise<void> {
        if (lock) {
            await setKvItem(KV_KEYS.walletLock, lock);
        } else {
            await deleteKvItem(KV_KEYS.walletLock);
        }
    }

    async getLock(): Promise<OpenLockConfig | null> {
        const lock = await getKvItem<OpenLockConfig>(KV_KEYS.walletLock);
        return lock;
    }

    generateNewSeedPhrase(): string {
        return generateMnemonic();
    }
}

export const walletService = new WalletService();
