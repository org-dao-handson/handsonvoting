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
  poolAddress: string;
  onNext: () => void;
};

export default function DonationView({
  poolAddress,
  onNext,
}: DonationViewProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean>(false);

  const flagUrl = `${window.location.origin}/api/admin/flag`;

  // Poll for admin approval continuously from mount
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(flagUrl);
        if (res.ok) {
          const { approved: isApproved } = await res.json();
          if (isApproved) {
            setApproved(true);
            return; // stop polling
          }
        }
      } catch {
        // ignore
      }
      setTimeout(poll, 3000);
    };

    poll();
    return () => { cancelled = true };
  }, [flagUrl]);

  const handleDonate = async () => {
    setError(null);
    setSuccessTxHash(null);

    if (!amount || isNaN(Number(amount))) {
      setError('Please enter a valid ETH amount');
      return;
    }
    if (!(window as any).ethereum) {
      setError('MetaMask not found');
      return;
    }

    try {
      setLoading(true);
      const provider = new BrowserProvider((window as any).ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: poolAddress,
        value: parseEther(amount),
      });
      setSuccessTxHash(tx.hash);

      await tx.wait();
    } catch (e: any) {
      console.error('Donation error:', e);
      setError(e?.message || 'Transaction failed');
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
        Donate to pool A: <code>{poolAddress}</code>
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
