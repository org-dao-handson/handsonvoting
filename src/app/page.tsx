'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import WelcomeScreen from '@/components/WelcomeScreen';
import ConnectWalletScreen from '@/components/ConnectWalletScreen';
import StepIndicator from '@/components/StepIndicator';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import { Wallet, JsonRpcSigner } from 'ethers';
import CensusCreationScreen from '@/components/CensusCreationScreen';
import CreateElectionScreen from '@/components/CreateElectionScreen';
import CheckElectionScreen from '@/components/CheckElectionScreen';

const DonationView = dynamic(
  () => import('@/components/DonationView'),
  { ssr: false, loading: () => <div>Loading donation view…</div> }
);
const VotingScreen = dynamic(
  () => import('@/components/VotingScreen'),
  { ssr: false, loading: () => <div>Loading voting screen…</div> }
);

import EndProcessScreen from '@/components/EndProcessScreen';
import ShowResultsScreen from '@/components/ShowResultsScreen';

const theme = createTheme({
  palette: {
    primary: { main: '#2B6CB0' },
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

// Gather pool settings from environment
const POOLS = [
  {
    name: process.env.NEXT_PUBLIC_POOL_A_NAME!,
    address: process.env.NEXT_PUBLIC_POOL_A_ADDRESS!,
  },
  {
    name: process.env.NEXT_PUBLIC_POOL_B_NAME!,
    address: process.env.NEXT_PUBLIC_POOL_B_ADDRESS!,
  },
  {
    name: process.env.NEXT_PUBLIC_POOL_C_NAME!,
    address: process.env.NEXT_PUBLIC_POOL_C_ADDRESS!,
  },
  {
    name: process.env.NEXT_PUBLIC_POOL_D_NAME!,
    address: process.env.NEXT_PUBLIC_POOL_D_ADDRESS!,
  },
];

// Validate environment variables
POOLS.forEach(({ name, address }, idx) => {
  if (!name) {
    throw new Error(`Missing NEXT_PUBLIC_POOL_${String.fromCharCode(65 + idx)}_NAME environment variable`);
  }
  if (!address) {
    throw new Error(`Missing NEXT_PUBLIC_POOL_${String.fromCharCode(65 + idx)}_ADDRESS environment variable`);
  }
});

export default function Home() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [wallet, setWallet] = useState<Wallet | JsonRpcSigner | null>(null);

  const handleWalletConnected = useCallback(
    (w: Wallet | JsonRpcSigner) => setWallet(w),
    []
  );
  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => prev - 1);

  // Build step labels
  const steps: string[] = [
    'Welcome',
    'Connect Wallet',
    ...POOLS.flatMap(pool => [`Donate to ${pool.name}`, `Vote - ${pool.name}`]),
    'End Process',
    'Show Results',
  ];

  const renderStep = () => {
    // Welcome
    if (currentStep === 0) {
      return <WelcomeScreen onNext={handleNext} />;
    }
    // Connect Wallet
    if (currentStep === 1) {
      return (
        <ConnectWalletScreen
          onNext={handleNext}
          onBack={handleBack}
          onWalletConnected={handleWalletConnected}
        />
      );
    }

    // Pool steps
    const poolStepsStart = 2;
    const poolStepCount = POOLS.length * 2;
    if (currentStep >= poolStepsStart && currentStep < poolStepsStart + poolStepCount) {
      const idx = Math.floor((currentStep - poolStepsStart) / 2);
      const isDonation = (currentStep - poolStepsStart) % 2 === 0;
      const pool = POOLS[idx];

      if (isDonation) {
        return (
          <DonationView
            poolAddress={pool.address}
            poolName={pool.name}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      } else {
        return (
          <VotingScreen
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      }
    }

    // End Process
    const endStepIndex = poolStepsStart + poolStepCount;
    if (currentStep === endStepIndex) {
      return wallet ? (
        <EndProcessScreen
          onNext={handleNext}
          onBack={handleBack}
          wallet={wallet}
        />
      ) : (
        <WelcomeScreen onNext={handleNext} />
      );
    }

    // Show Results
    if (currentStep === endStepIndex + 1) {
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

    // Fallback
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
