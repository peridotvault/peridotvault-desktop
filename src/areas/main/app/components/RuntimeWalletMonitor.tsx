import { useEffect, useRef } from 'react';
import { useWallet, useWalletUpdate } from '@shared/contexts/WalletContext';
import { redirectToLogin } from '@shared/desktop/windowControls';
import { getPeridotRuntimeWallet } from '@shared/services/peridot-runtime';
import { clearWalletData } from '@shared/services/store';
import { logout } from '@shared/services/auth-init.service';

export const RuntimeWalletMonitor = () => {
  const { wallet, isCheckingWallet } = useWallet();
  const updateWallet = useWalletUpdate();
  const redirectInFlightRef = useRef(false);

  useEffect(() => {
    if (isCheckingWallet || redirectInFlightRef.current) {
      return;
    }

    let isMounted = true;

    const syncRuntimeWalletState = async () => {
      const runtimeWallet = await getPeridotRuntimeWallet();

      if (!isMounted || redirectInFlightRef.current) {
        return;
      }

      if (runtimeWallet) {
        if (!wallet.runtimeWallet) {
          updateWallet({ runtimeWallet });
        }
        return;
      }

      if (!wallet.runtimeWallet) {
        return;
      }

      redirectInFlightRef.current = true;

      try {
        await logout();
        await clearWalletData();
      } finally {
        updateWallet({
          encryptedSeedPhrase: null,
          encryptedPrivateKey: null,
          lock: null,
          verificationData: null,
          runtimeWallet: null,
        });
      }

      redirectToLogin();
    };

    void syncRuntimeWalletState();

    const intervalId = window.setInterval(() => {
      void syncRuntimeWalletState();
    }, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isCheckingWallet, updateWallet, wallet.runtimeWallet]);

  return null;
};
