import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface WalletSidebarProps {
  open: boolean;
  onClose: () => void;
  leftClassName?: string;
  title?: string;
}

export const WalletSidebar: React.FC<WalletSidebarProps> = ({
  open,
  onClose,
  leftClassName = 'left-16',
  title = 'Peridot Wallet',
}) => {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel (slide from left) */}
          <motion.div
            className={[
              'fixed bottom-0 top-12 w-100 bg-background border-r border-foreground/10 shadow-2xl',
              'flex flex-col z-40',
              leftClassName,
            ].join(' ')}
            role="dialog"
            aria-label={title}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 40, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* The iframe is now persistent in MainLayout */}
            <div className="flex-1" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
