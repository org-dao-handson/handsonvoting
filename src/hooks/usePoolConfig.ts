// src/hooks/usePoolConfig.ts
import { useState, useEffect } from 'react';

interface PoolConfig {
  poolAName: string;
  poolAAddress: string;
}

export function usePoolConfig() {
  const [config, setConfig] = useState<PoolConfig>({
    poolAName: process.env.NEXT_PUBLIC_POOL_A_NAME || 'Pool A',
    poolAAddress: process.env.NEXT_PUBLIC_POOL_A_ADDRESS || '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize configuration by calling our API endpoint
    async function initializeConfig() {
      try {
        const initRes = await fetch('/api/config/initialize', { method: 'POST' });
        if (!initRes.ok) {
          console.warn('Failed to initialize config');
        }
      } catch (error) {
        console.error('Error initializing config:', error);
      }
    }

    async function fetchConfig() {
      try {
        // First ensure config is initialized
        await initializeConfig();

        // Then fetch the current values
        const res = await fetch('/api/config/getPoolParameters');
        if (res.ok) {
          const data = await res.json();
          setConfig({
            poolAName: data.poolAName || config.poolAName,
            poolAAddress: data.poolAAddress || config.poolAAddress,
          });
        }
      } catch (error) {
        console.error('Failed to fetch pool configuration:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return { config, loading };
}
