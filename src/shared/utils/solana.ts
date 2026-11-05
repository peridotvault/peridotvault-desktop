// @ts-ignore
import { deriveSolanaKeypairFromMnemonic } from "@antigane/peridotwallet-runtime";

/**
 * Derive Solana address from seed phrase (m/44'/501'/0'/0')
 */
export function deriveSvmAddressFromSeed(seedPhrase: string): string {
    const { publicKey } = deriveSolanaKeypairFromMnemonic(seedPhrase);
    return publicKey;
}
