// lib/initConfig.ts
import redis from './redis';

// Initialize config with defaults from environment variables
async function initializeConfig() {
  const poolName = await redis.get('POOL_NAME');
  const poolAddress = await redis.get('POOL_ADDRESS');

  if (!poolName) {
    await redis.set('POOL_NAME', process.env.NEXT_PUBLIC_POOL_NAME || process.env.NEXT_PUBLIC_POOL_A_NAME || 'Pool');
  }

  if (!poolAddress) {
    await redis.set('POOL_ADDRESS', process.env.NEXT_PUBLIC_POOL_ADDRESS || process.env.NEXT_PUBLIC_POOL_A_ADDRESS || '');
  }
}

export { initializeConfig };
