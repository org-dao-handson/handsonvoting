'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import ShowResultsScreen from '@/components/ShowResultsScreen';
import ConnectWalletScreen from '@/components/ConnectWalletScreen';
import { ThemeProvider, createTheme, Box, CircularProgress } from '@mui/material';
import { Wallet, JsonRpcSigner, BrowserProvider } from 'ethers';

const theme = createTheme({
  palette: {
    primary: { main: '#0028A5' },
    secondary: { main: '#4A5568' },
    background: { default: '#F7FAFC' },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none' } },
    },
  },
});

export default function ResultsPage() {
  const [wallet, setWallet] = useState<Wallet | JsonRpcSigner | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Try to reconnect wallet on page load
  useEffect(() => {
    const connectExistingWallet = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const provider = new BrowserProvider((window as any).ethereum);
          const accounts = await provider.listAccounts();

          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            setWallet(signer);
          }
        }
      } catch (error) {
        console.error('Error reconnecting wallet:', error);
      } finally {
        setLoading(false);
      }
    };

    connectExistingWallet();
  }, []);

  const handleWalletConnected = (w: Wallet | JsonRpcSigner) => {
    setWallet(w);
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleNext = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <Layout>
          <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
            <CircularProgress />
          </Box>
        </Layout>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Layout>
        <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: 3 }}>
          {wallet ? (
            <ShowResultsScreen
              onNext={handleNext}
              onBack={handleBack}
              wallet={wallet}
            />
          ) : (
            <ConnectWalletScreen
              onNext={() => {}}
              onBack={handleBack}
              onWalletConnected={handleWalletConnected}
            />
          )}
        </Box>
      </Layout>
    </ThemeProvider>
  );
}
