import { mnemonicToSeedSync } from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/curves/abstract/utils';
import { createWalletClient, custom, getAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { EVM_RPC_URL } from '@shared/constants/storage';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const bip32 = BIP32Factory(ecc);

/**
 * Get checksummed Ethereum address from seed phrase.
 * This ensures the address is properly formatted.
 */
export function deriveEvmAddressFromSeed(mnemonic: string): `0x${string}` {
    const seed = mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed);
    
    // Standard Ethereum derivation path: m/44'/60'/0'/0/0
    const child = root.derivePath("m/44'/60'/0'/0/0");
    
    if (!child.privateKey) {
        throw new Error('Failed to derive private key');
    }

    // Get public key from private key
    const publicKey = ecc.pointFromScalar(child.privateKey, false);
    if (!publicKey) {
        throw new Error('Failed to derive public key');
    }

    // Skip the first byte (0x04 prefix for uncompressed public key)
    const publicKeyWithoutPrefix = publicKey.slice(1);
    
    // Keccak-256 hash of the public key
    const hash = keccak_256(publicKeyWithoutPrefix);
    
    // The address is the last 20 bytes of the hash
    const addressBytes = hash.slice(-20);
    const rawAddress = `0x${bytesToHex(addressBytes)}`;
    
    // Convert to checksummed address using viem's getAddress
    return getAddress(rawAddress);
}

/**
 * Derive EVM private key from seed phrase.
 */
export function deriveEvmPrivateKeyFromSeed(mnemonic: string): `0x${string}` {
    const seed = mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed);
    const child = root.derivePath("m/44'/60'/0'/0/0");

    if (!child.privateKey) {
        throw new Error('Failed to derive private key');
    }

    return `0x${Buffer.from(child.privateKey).toString('hex')}` as `0x${string}`;
}

// Custom transport using Tauri's HTTP API to bypass CORS
const tauriHttpTransport = () => {
    const RPC_URL = EVM_RPC_URL;
    return custom({
        async request({ method, params }: { method: string; params?: any }) {
            const response = await tauriFetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Math.floor(Math.random() * 1000000),
                    method,
                    params,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || 'RPC error');
            }

            return data.result;
        },
    });
};

/**
 * Sign a message using the EVM wallet derived from seed phrase.
 * Uses viem's walletClient for proper EIP-191 message signing.
 */
export async function signMessageWithEvm(
    message: string,
    seedPhrase: string
): Promise<`0x${string}`> {
    const privateKey = deriveEvmPrivateKeyFromSeed(seedPhrase);
    const account = privateKeyToAccount(privateKey);

    console.log('[EVM] Signing message with account:', account.address);
    console.log('[EVM] Message to sign:', message);

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: tauriHttpTransport(),
    });

    const signature = await walletClient.signMessage({
        message,
    });

    console.log('[EVM] Signature produced:', signature);
    console.log('[EVM] Signature length:', signature.length);

    return signature;
}
