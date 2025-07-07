'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Typography, TextField, Alert, CircularProgress } from '@mui/material';
// Ethers v6: use BrowserProvider
import { BrowserProvider, parseEther } from 'ethers';

type DonationViewProps = {
  poolAddress: string;
  onNext: () => void;
};

export default function DonationView({ poolAddress, onNext }: DonationViewProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // After a successful donation, poll the server flag
  useEffect(() => {
    if (!success) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/flag');
        if (!res.ok) return;
        const data = await res.json();
        if (data.approved) {
          clearInterval(interval);
          onNext();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [success, onNext]);

  const handleDonate = async () => {
    setError(null);
    setSuccess(null);

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

      // Fetch current fee data for EIP-1559
      const feeData = await provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw new Error('Unable to fetch gas fee data');
      }

      // Build transaction with explicit fee fields
      const txParams = {
        to: poolAddress,
        value: parseEther(amount),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        maxFeePerGas: feeData.maxFeePerGas,
      };

      const tx = await signer.sendTransaction(txParams);
      await tx.wait();

      setSuccess(tx.hash);
      setAmount('');
    } catch (e: any) {
      console.error('Donation error', e);
      setError(e.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        How much money would you like to donate to pool A ({poolAddress})?
      </Typography>

      {!success && (
        <>
          <TextField
            label="Amount (ETH)"
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

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Donation confirmed! Tx hash: {success}. Waiting for approval...
        </Alert>
      )}
    </Box>
  );
}
