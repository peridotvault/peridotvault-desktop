import React, { createContext, useContext, useEffect, useState } from 'react';
import { WalletData } from '../services/wallet';
import { getWalletData, saveWalletData } from '../services/store';
import { EncryptedData } from '@shared/security/aes';

interface WalletContextData {
  wallet: WalletData;
  setWallet: React.Dispatch<React.SetStateAction<WalletData>>;
  isGeneratedSeedPhrase: boolean;
  setIsGeneratedSeedPhrase: React.Dispatch<React.SetStateAction<boolean>>;
  isCheckingWallet: boolean;
  setIsCheckingWallet: React.Dispatch<React.SetStateAction<boolean>>;
}

const WalletContext = createContext<WalletContextData | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData>({
    encryptedSeedPhrase: null,
    encryptedPrivateKey: null,
    lock: null,
    verificationData: null,
    runtimeWallet: null,
  });

  const [isGeneratedSeedPhrase, setIsGeneratedSeedPhrase] = useState(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);

  // Load wallet data when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storedWallet = await getWalletData();
        if (storedWallet) {
          setWallet(storedWallet);
          // Set other states based on stored encrypted data
          setIsGeneratedSeedPhrase(!!storedWallet.encryptedSeedPhrase);
        }
        setIsCheckingWallet(false);
      } catch (error) {
        console.error('Error loading initial wallet data:', error);
        setIsCheckingWallet(false);
      }
    };

    loadInitialData();
  }, []);

  // Save wallet data whenever it changes
  useEffect(() => {
    const saveWallet = async () => {
      try {
        // Only save if we have either encrypted seed phrase or password
        if (wallet.encryptedSeedPhrase || wallet.runtimeWallet) {
          await saveWalletData(wallet);
        }
      } catch (error) {
        console.error('Error saving wallet:', error);
      }
    };

    saveWallet();
  }, [wallet]);

  const value = React.useMemo(
    () => ({
      wallet,
      setWallet,
      isGeneratedSeedPhrase,
      setIsGeneratedSeedPhrase,
      isCheckingWallet,
      setIsCheckingWallet,
    }),
    [
      wallet,
      setWallet,
      isGeneratedSeedPhrase,
      setIsGeneratedSeedPhrase,
      isCheckingWallet,
      setIsCheckingWallet,
    ],
  );

  return <WalletContext.Provider value={value}> {children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Helper types for better type checking
export type UpdateWalletParams = Partial<WalletData>;

// Helper hooks for common operations
export function useWalletUpdate() {
  const { setWallet } = useWallet();

  return React.useCallback(
    (updates: UpdateWalletParams) => {
      setWallet((currentWallet) => ({
        ...currentWallet,
        ...updates,
      }));
    },
    [setWallet],
  );
}

export function useEncryptedSeedPhrase(): EncryptedData | null {
  const { wallet } = useWallet();
  return wallet.encryptedSeedPhrase;
}

export function useEncryptedPrivateKey(): EncryptedData | null {
  const { wallet } = useWallet();
  return wallet.encryptedPrivateKey;
}
