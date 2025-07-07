'use client';

import { useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import WelcomeScreen from '@/components/WelcomeScreen';
import ConnectWalletScreen from '@/components/ConnectWalletScreen';
import DonationView from '@/components/DonationView';
import StepIndicator from '@/components/StepIndicator';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import { Wallet, JsonRpcSigner } from 'ethers';
import CensusCreationScreen from '@/components/CensusCreationScreen';
import CreateElectionScreen from '@/components/CreateElectionScreen';
import CheckElectionScreen from '@/components/CheckElectionScreen';
import VotingScreen from '@/components/VotingScreen';
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

const STEPS = [
  'Welcome',
  'Connect Wallet',
  'Submit Money to Pool',
  'Vote',
  'End Process',
  'Show Results',
] as const;

enum Step {
  Welcome,
  ConnectWallet,
  DonationView,
  Vote,
  EndProcess,
  ShowResults,
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>(Step.Welcome);
  const [wallet, setWallet] = useState<Wallet | JsonRpcSigner | null>(null);
  const [censusId, setCensusId] = useState<string | null>(null);

  // Replace with your actual pool A address
  const POOL_A_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

  const handleWalletConnected = useCallback(
    (connectedWallet: Wallet | JsonRpcSigner) => {
      setWallet(connectedWallet);
    },
    []
  );

  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => prev - 1);

  const renderStep = () => {
    switch (currentStep) {
      case Step.Welcome:
        return <WelcomeScreen onNext={handleNext} />;
      case Step.ConnectWallet:
        return (
          <ConnectWalletScreen
            onNext={handleNext}
            onBack={handleBack}
            onWalletConnected={handleWalletConnected}
          />
        );
      case Step.DonationView:
        return (
      <DonationView
        poolAddress={POOL_A_ADDRESS}
        onNext={handleNext}
      />
      );
      case Step.Vote:
        return <VotingScreen onNext={() => setCurrentStep(Step.EndProcess)} onBack={handleBack} />;
      case Step.EndProcess:
        return wallet ? (
          <EndProcessScreen
            onNext={() => setCurrentStep(Step.ShowResults)}
            onBack={handleBack}
            wallet={wallet}
          />
        ) : (
          <WelcomeScreen onNext={handleNext} />
        );
      case Step.ShowResults:
        return wallet ? (
          <ShowResultsScreen onNext={() => setCurrentStep(Step.Welcome)} onBack={handleBack} wallet={wallet} />
        ) : (
          <WelcomeScreen onNext={handleNext} />
        );
      default:
        return <WelcomeScreen onNext={handleNext} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Layout>
        <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: 3 }}>
          <StepIndicator activeStep={currentStep} steps={STEPS} />
          {renderStep()}
        </Box>
      </Layout>
    </ThemeProvider>
  );
}
