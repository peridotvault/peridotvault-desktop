import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@shared/assets/styles/index.css';
import { WalletProvider } from '@shared/contexts/WalletContext';
import { Buffer } from 'buffer';
import router from './app/routes';
import { DownloadProvider } from './features/download/components/DownloadManager';
import { RuntimeWalletMonitor } from './app/components/RuntimeWalletMonitor';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Create a root wrapper component
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <RuntimeWalletMonitor />
      <DownloadProvider>
        <RouterProvider router={router} />
      </DownloadProvider>
    </WalletProvider>
  </React.StrictMode>,
);
