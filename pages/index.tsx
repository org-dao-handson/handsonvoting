import { useState } from 'react';
import dynamic from 'next/dynamic';
import WelcomeScreen from '@/components/WelcomeScreen';
import ConnectWalletScreen from '@/components/ConnectWalletScreen';
import StepIndicator from '@/components/StepIndicator';
import { Wallet, JsonRpcSigner } from 'ethers';
import EndProcessScreen from '@/components/EndProcessScreen';
import ShowResultsScreen from '@/components/ShowResultsScreen';

// DonationView is client-only; disable SSR for it:
const DonationView = dynamic(
  () => import('@/components/DonationView'),
  { ssr: false, loading: () => <div>Loading donation view…</div> }
);

const VotingScreen = dynamic(
  () => import('@/components/VotingScreen'),
  { ssr: false, loading: () => <div>Loading voting screen…</div> }
);

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

  // Load pool settings from environment
  const POOL_A_ADDRESS = process.env.NEXT_PUBLIC_POOL_A_ADDRESS!;
  if (!POOL_A_ADDRESS) {
    throw new Error('Missing NEXT_PUBLIC_POOL_A_ADDRESS environment variable');
  }
  const POOL_NAME = process.env.NEXT_PUBLIC_POOL_A_NAME!;
  if (!POOL_NAME) {
    throw new Error('Missing NEXT_PUBLIC_POOL_NAME environment variable');
  }

  // Step titles, using pool name dynamically
  const STEPS = [
    'Welcome',
    'Connect Wallet',
    `Donate to ${POOL_NAME}`,
    'Vote',
    'End Process',
    'Show Results',
  ] as const;

  const handleWalletConnected = (w: Wallet | JsonRpcSigner) => setWallet(w);
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
            poolName={POOL_NAME}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case Step.Vote:
        return (
          <VotingScreen
            onNext={() => setCurrentStep(Step.EndProcess)}
            onBack={handleBack}
          />
        );
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
          <ShowResultsScreen
            onNext={() => setCurrentStep(Step.Welcome)}
            onBack={handleBack}
            wallet={wallet}
          />
        ) : (
          <WelcomeScreen onNext={handleNext} />
        );
      default:
        return <WelcomeScreen onNext={handleNext} />;
    }
  };

  return (
    <div>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <StepIndicator activeStep={currentStep} steps={STEPS} />
        {renderStep()}
      </div>
    </div>
  );
}
