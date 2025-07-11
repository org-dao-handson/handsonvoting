// File: components/DonationView.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  FormHelperText,
} from '@mui/material';
import { BrowserProvider, parseEther } from 'ethers';

type DonationViewProps = {
  readonly poolAddress: string;
  readonly poolName: string;
  readonly onNext: () => void;
};

// Minimum donation amount in ETH
const MIN_DONATION_AMOUNT = 0.1000001;

export default function DonationView({
  poolAddress,
  poolName,
  onNext,
}: DonationViewProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [canProceed, setCanProceed] = useState<boolean>(false);

  // Check if the amount is valid (> MIN_DONATION_AMOUNT ETH)
  const isAmountValid = useMemo(() => {
    if (!amount || isNaN(Number(amount))) return false;
    return Number(amount) >= MIN_DONATION_AMOUNT;
  }, [amount]);

  const proceedToVotingUrl = `${window.location.origin}/api/admin/proceedToVoting`;

  // Poll for proceed to voting permission
  useEffect(() => {
    let cancelled = false;
    const pollProceedStatus = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(proceedToVotingUrl);
        if (res.ok) {
          const data = await res.json();
          setCanProceed(data.canProceed === true);
        }
      } catch (error) {
        console.error('Error polling proceedToVoting:', error);
      }
      setTimeout(pollProceedStatus, 3000);
    };
    pollProceedStatus();
    return () => {
      cancelled = true;
    };
  }, [proceedToVotingUrl]);

  // Helper function to extract user-friendly error messages
  const getUserFriendlyError = (error: unknown): string => {
    const errorStr = String(error);

    // Check for user rejection patterns
    if (
      errorStr.includes('user rejected') ||
      errorStr.includes('User denied transaction') ||
      errorStr.includes('ACTION_REJECTED') ||
      errorStr.includes('code=4001')
    ) {
      return 'Transaction was rejected in the wallet. Please try again.';
    }

    // Check for specific contract error messages
    if (errorStr.includes('Must send > 0.1 ETH')) {
      return `Please donate at least ${MIN_DONATION_AMOUNT} ETH.`;
    }

    // Default error message
    return error instanceof Error ? error.message : 'Transaction failed';
  };

  const handleDonate = async () => {
    setError(null);
    setSuccessTxHash(null);

    if (!amount || isNaN(Number(amount))) {
      setError('Please enter a valid ETH amount');
      return;
    }

    if (Number(amount) < MIN_DONATION_AMOUNT) {
      setError(`You must send at least ${MIN_DONATION_AMOUNT} ETH`);
      return;
    }

    if (!window.ethereum) {
      setError('MetaMask not found');
      return;
    }

    try {
      setLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: poolAddress,
        value: parseEther(amount),
      });
      setSuccessTxHash(tx.hash);

      await tx.wait();
    } catch (error: unknown) {
      console.error('Donation error:', error);
      setError(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 400,
        mx: 'auto',
        mt: 4,
        p: 2,
        border: '1px solid #eee',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Donate to {poolName}: <code>{poolAddress}</code>
      </Typography>

      {!successTxHash ? (
        <>
          <Box component="form" noValidate sx={{ mt: 2, mb: 2 }}>
            <TextField
              label="Amount (ETH)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              disabled={loading}
              helperText={
                amount && !isAmountValid
                  ? `Minimum donation is ${MIN_DONATION_AMOUNT} ETH`
                  : ''
              }
              error={amount !== '' && !isAmountValid}
            />
            {error && (
              <FormHelperText error sx={{ mt: 1, fontSize: '0.875rem' }}>
                {error}
              </FormHelperText>
            )}
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleDonate}
            disabled={loading || !amount || !isAmountValid}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {loading ? 'Sending…' : 'Donate'}
          </Button>
        </>
      ) : (
        <Alert severity="success" sx={{ mt: 2 }}>
          Donation sent! Tx hash{' '}
          <code style={{ wordBreak: 'break-all' }}>{successTxHash}</code>.
        </Alert>
      )}

      {/* Next button always visible, enabled as soon as approved */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </Box>
    </Box>
  );
}
