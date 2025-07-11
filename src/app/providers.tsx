// src/app/providers.tsx
'use client';

import { WalletProvider } from '@/context/WalletContext';

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialization is now handled by the usePoolConfig hook directly
  // This prevents any server-side modules from being imported in client components

  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}
