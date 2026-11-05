import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightFromBracket,
  faGamepad,
  faGear,
  faUser,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { ButtonWithSound } from './ui/ButtonWithSound';
import { clearWalletData } from '@shared/services/store';
import { logout } from '@shared/services/auth-init.service';
import { useWalletUpdate } from '@shared/contexts/WalletContext';
import { redirectToLogin } from '@shared/desktop/windowControls';
import { Avatar } from '@shared/components/ui/avatar';

type Props = {
  open: boolean;
  onClose: () => void;
  leftClassName?: string;
  title?: string;
  storageKey?: string;
};

export const MenuAvatar = ({ open, onClose, leftClassName = 'left-24' }: Props) => {
  const updateWallet = useWalletUpdate();

  const list = [
    {
      href: '/profile',
      label: 'View Profile',
      icon: faUser,
    },
    {
      href: '/studio',
      label: 'Studio',
      icon: faGamepad,
    },
    {
      href: '#',
      label: 'Settings',
      icon: faGear,
    },
  ];

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const NavComponent = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: IconDefinition;
    label: string;
  }) => {
    return (
      <ButtonWithSound className="w-full">
        <Link to={href} className="hover:bg-foreground/10 rounded-lg flex items-center">
          <div className="w-10 h-10 flex justify-center items-center text-muted-foreground">
            <FontAwesomeIcon icon={icon} />
          </div>
          <label htmlFor={label}>{label}</label>
        </Link>
      </ButtonWithSound>
    );
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

      // 3. UX: tutup menu
      onClose();

      // 4. Pindah ke login window (di desktop: invoke open_login_window)
      redirectToLogin();
    } catch (error) {
      console.error('Error clearing wallet data:', error);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={[
              'fixed bottom-4 w-72 p-4 bg-background border-foreground/10 rounded-lg',
              'flex flex-col gap-2 z-40',
              leftClassName,
            ].join(' ')}
            role="dialog"
            aria-label="Menu Avatar"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 42, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* User  */}
            <section className="flex gap-4 items-center pb-1">
              <Avatar />
              <div className="flex flex-col gap-1">
                <span className="font-bold leading-4 line-clamp-1">
                  EVM Wallet
                </span>
                <span className="text-sm leading-3 line-clamp-1">m@example.com</span>
              </div>
            </section>

            <hr className="border-foreground/10" />

            {/* Main  */}
            <section className="flex flex-col">
              {list.map((item, index) => (
                <NavComponent key={index} href={item.href} icon={item.icon} label={item.label} />
              ))}
            </section>

            <hr className="border-foreground/10" />

            <section>
              <ButtonWithSound
                onClick={handleLogout}
                className="w-full hover:bg-foreground/10 rounded-lg flex items-center hover:cursor-pointer"
              >
                <div className="w-10 h-10 flex justify-center items-center text-muted-foreground">
                  <FontAwesomeIcon icon={faArrowRightFromBracket} />
                </div>
                <label htmlFor="Log out">Log out</label>
              </ButtonWithSound>
            </section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
