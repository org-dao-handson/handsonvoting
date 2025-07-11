// File: components/DonationView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { BrowserProvider, parseEther } from 'ethers';

type DonationViewProps = {
  readonly poolAddress: string;
  readonly poolName: string;
  readonly onNext: () => void;
};

export default function DonationView({
  poolAddress,
  poolName,
  onNext,
}: DonationViewProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean>(false);

  const voteOpenUrl = `${window.location.origin}/api/admin/voteOpen`;

  // Poll for admin approval
  useEffect(() => {
    let cancelled = false;
    const pollApproval = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(voteOpenUrl);
        if (res.ok) {
          const data = await res.json();
          // Check for voteOpen property in the response
          const isApproved = data.voteOpen !== undefined ? data.voteOpen : false;
          setApproved(isApproved);
        }
      } catch (error) {
        console.error('Error polling voteOpen:', error);
      }
      setTimeout(pollApproval, 3000);
    };
    pollApproval();
    return () => {
      cancelled = true;
    };
  }, [voteOpenUrl]);

  const handleDonate = async () => {
    setError(null);
    setSuccessTxHash(null);

    if (!amount || isNaN(Number(amount))) {
      setError('Please enter a valid ETH amount');
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
      const errorMessage =
        error instanceof Error ? error.message : 'Transaction failed';
      setError(errorMessage);
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
          <TextField
            label="Amount (ETH)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            disabled={loading}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleDonate}
            disabled={loading || !amount}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {loading ? 'Sending…' : 'Donate'}
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </>
      ) : (
        <Alert severity="success" sx={{ mt: 2 }}>
          Donation sent! Tx hash{' '}
          <code style={{ wordBreak: 'break-all' }}>{successTxHash}</code>.
        </Alert>
      )}

      {/* Next button always visible, enabled as soon as approved */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={onNext} disabled={!approved}>
          Next
        </Button>
      </Box>
    </Box>
  );
}
