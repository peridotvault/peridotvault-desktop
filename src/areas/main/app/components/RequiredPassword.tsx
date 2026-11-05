import React, { useRef } from 'react';
import { useWallet, useWalletUpdate } from '@shared/contexts/WalletContext';
import _ from 'lodash';
import { useWalletLockStore } from '@shared/states/wallet-lock.store';
import { InputFloating } from '@shared/components/ui/input-floating';
import { faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ButtonWithSound } from '@shared/components/ui/ButtonWithSound';
import { AnimatePresence, motion } from 'framer-motion';
import { clearWalletData } from '@shared/services/store';
import { logout } from '@shared/services/auth-init.service';
import { redirectToLogin } from '@shared/desktop/windowControls';
import { LoadingPage } from '@main/pages/additional/loading-page';
import { migratePeridotRuntimeWalletToDesktop } from '@shared/services/peridot-runtime';
import { hasRuntimeWalletData } from '@shared/services/wallet';

export const RequiredPassword = () => {
  const { wallet, isCheckingWallet } = useWallet();
  const { status, error, unlockWithPassword } = useWalletLockStore();
  const updateWallet = useWalletUpdate();
  const redirectRequestedRef = useRef(false);

  const [password, setPassword] = React.useState('');
  const [isForgotPassword, setForgotPassword] = React.useState(false);
  const [runtimeError, setRuntimeError] = React.useState<string | null>(null);

  const hasDesktopWallet = !!wallet.verificationData; // Check for desktop wallet
  const hasRuntimeWallet = hasRuntimeWalletData(wallet);

  // inisialisasi lock di awal
  React.useEffect(() => {
    if (isCheckingWallet) return;

    // cek kalau wallet belum lengkap → lempar ke login (sekali saja)
    if (!hasDesktopWallet && !hasRuntimeWallet && !redirectRequestedRef.current) {
      redirectRequestedRef.current = true;
      redirectToLogin();
      return;
    }

    // init lock state dari KV
    useWalletLockStore.getState().initFromStorage();
  }, [hasDesktopWallet, hasRuntimeWallet, isCheckingWallet]);

  const handleConfirm = async () => {
    try {
      setRuntimeError(null);

      if (wallet.verificationData) {
        await unlockWithPassword(password, wallet.verificationData, 30);
        setPassword('');
        return;
      }

      if (!wallet.runtimeWallet) {
        return;
      }

      const migratedWallet = await migratePeridotRuntimeWalletToDesktop(wallet.runtimeWallet, password);

      updateWallet({
        encryptedSeedPhrase: migratedWallet.encryptedSeedPhrase,
        encryptedPrivateKey: migratedWallet.encryptedPrivateKey,
        verificationData: migratedWallet.verificationData,
      });

      await unlockWithPassword(password, migratedWallet.verificationData, 30);
      setPassword('');
    } catch {
      if (!wallet.verificationData) {
        setRuntimeError('Invalid password');
      }
    }
  };

  const handleLogout = async () => {
    try {
      // 1. clear auth session, library data, and wallet data
      await logout();
      await clearWalletData();

      // 2. reset in-memory wallet
      updateWallet({
        encryptedSeedPhrase: null,
        encryptedPrivateKey: null,
        lock: null,
        verificationData: null,
        runtimeWallet: null,
      });

      // 4. Pindah ke login window (di desktop: invoke open_login_window)
      redirectToLogin();
    } catch (error) {
      console.error('Error clearing wallet data:', error);
    }
  };

  if (status === 'checking') {
    return <LoadingPage />;
  }

  return (
    <AnimatePresence /* initial={false} boleh ditambah kalau mau */>
      {status === 'locked' && (
        <motion.div
          className="backdrop-blur-sm bg-black/50 fixed z-90 w-full h-full flex justify-center items-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Panel (slide from left) */}
          <motion.div
            className="bg-card mt-12 rounded-b-lg p-10 w-[400px] flex flex-col gap-4 items-center "
            role="dialog"
            aria-label="Required Password"
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 42, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-2xl pb-4 font-bold">Unlock your Wallet</span>
            <div className="flex flex-col gap-4 w-full ">
              <InputFloating
                type="password"
                value={password}
                bgColor="bg-card"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm();
                  }
                }}
              />
              {(error || runtimeError) && (
                <p className="text-chart-5 text-sm">{runtimeError ?? error}</p>
              )}
            </div>

            <ButtonWithSound
              onClick={handleConfirm}
              disabled={!password}
              className={`${password ? 'bg-accent hover:scale-105 cursor-pointer' : 'bg-muted text-muted-foreground cursor-not-allowed'}  py-3 px-6 w-full rounded-md duration-300 flex gap-1 items-center justify-center`}
            >
              <FontAwesomeIcon icon={faUnlock} />
              <span>Unlock</span>
            </ButtonWithSound>

            <ButtonWithSound
              onClick={() => setForgotPassword(true)}
              className="text-sm text-accent-foreground hover:scale-105 duration-100 cursor-pointer"
            >
              Forgot Password?
            </ButtonWithSound>

            <AnimatePresence>
              {isForgotPassword && (
                <ModalForgotPassword
                  onClose={() => setForgotPassword(false)}
                  onLogout={handleLogout}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ModalForgotPassword = ({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout: () => void;
}) => {
  return (
    // Backdrop
    <motion.div
      className="backdrop-blur-sm bg-black/50 absolute top-0 right-0 z-91 w-full h-full flex justify-center items-start"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} // <- sekarang bakal kepakai
    >
      {/* Panel */}
      <motion.div
        className="bg-card mt-12 rounded-b-lg p-10 w-[400px] flex flex-col gap-4 items-center "
        role="dialog"
        aria-label="Forgot Password"
        initial={{ y: '-100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '-100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 480, damping: 42, mass: 0.8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex flex-col gap-4 items-center py-12">
          <div className="bg-muted rounded-full aspect-square p-8 flex items-center justify-center">
            <FontAwesomeIcon icon={faLock} className="text-muted-foreground text-5xl" />
          </div>
          <span className="text-3xl font-bold">Forgot Password</span>
          <p className="text-center ">
            By continuing you will be logged out and all your settings will be reset to defaults,
            PeridotVault cannot recover your SeedPhrase or Password for you.
          </p>
        </div>
        <ButtonWithSound
          onClick={onLogout}
          className="bg-chart-5 w-full p-3 rounded-md font-bold uppercase"
        >
          I Understand
        </ButtonWithSound>
      </motion.div>
    </motion.div>
  );
};
