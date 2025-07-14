'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import WelcomeScreen from '@/components/WelcomeScreen';
import ConnectWalletScreen from '@/components/ConnectWalletScreen';
import StepIndicator from '@/components/StepIndicator';
import { ThemeProvider, createTheme, Box, CircularProgress } from '@mui/material';
import { Wallet, JsonRpcSigner } from 'ethers';
import ShowResultsScreen from '@/components/ShowResultsScreen';
import { usePoolConfig } from '@/hooks/usePoolConfig';

// src/app/page.tsx
import DonationView from '../components/DonationView'

const VotingScreen = dynamic(
  () => import('@/components/VotingScreen'),
  { ssr: false, loading: () => <div>Loading voting screen…</div> }
);

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

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [wallet, setWallet] = useState<Wallet | JsonRpcSigner | null>(null);
  const { config, loading } = usePoolConfig();

  const handleWalletConnected = useCallback(
    (w: Wallet | JsonRpcSigner) => setWallet(w),
    []
  );
  const handleNext = () => setCurrentStep((s) => s + 1);
  const handleBack = () => setCurrentStep((s) => s - 1);

  // Now: Welcome, Connect, Donate, Vote, Show Results
  const steps = [
    'Welcome',
    'Connect Wallet',
    `Donate to Pool`,
    `Vote on distribution`,
    'Show Results',
  ];

  // Show loading indicator while fetching pool configuration
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Create POOLS array from the fetched configuration
  const POOLS = [
    {
      name: config.poolName,
      address: config.poolAddress,
    }
  ];

  // Validate pool configuration
  if (!config.poolName || !config.poolAddress) {
    return (
      <Box padding={3}>
        <h1>Configuration Error</h1>
        <p>Missing pool configuration. Please check your settings.</p>
      </Box>
    );
  }

  const renderStep = () => {
    if (currentStep === 0) {
      return <WelcomeScreen onNext={handleNext} />;
    }
    if (currentStep === 1) {
      return (
        <ConnectWalletScreen
          onNext={handleNext}
          onBack={handleBack}
          onWalletConnected={handleWalletConnected}
        />
      );
    }

    // Pool steps start at index 2, count = donation + 1 vote = 2
    const poolStart = 2;
    const poolCount = POOLS.length + 1; // 1 donation + 1 vote

    if (currentStep >= poolStart && currentStep < poolStart + poolCount) {
      const offset = currentStep - poolStart;

      if (offset === 0) {
        // DonationView for Pool A
        const p = POOLS[0];
        return (
          <DonationView
            poolAddress={p.address}
            poolName={p.name}
            onNext={handleNext}
      
          />
        );
      }

      // offset === 1 → VotingScreen
      return <VotingScreen onBack={handleBack} />;
    }

    // Show Results now immediately follows
    const resultsIndex = poolStart + poolCount;
    if (currentStep === resultsIndex) {
      return wallet ? (
        <ShowResultsScreen
          onNext={() => setCurrentStep(0)}
          onBack={handleBack}
          wallet={wallet}
        />
      ) : (
        <WelcomeScreen onNext={handleNext} />
      );
    }

    return <WelcomeScreen onNext={handleNext} />;
  };

  return (
    <ThemeProvider theme={theme}>
      <Layout>
        <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: 3 }}>
          <StepIndicator activeStep={currentStep} steps={steps} />
          {renderStep()}
        </Box>
      </Layout>
    </ThemeProvider>
  );
}
