// lib/initConfig.ts
import redis from './redis';

// Initialize config with defaults from environment variables
async function initializeConfig() {
  const poolAName = await redis.get('POOL_A_NAME');
  const poolAAddress = await redis.get('POOL_A_ADDRESS');

  if (!poolAName) {
    await redis.set('POOL_A_NAME', process.env.NEXT_PUBLIC_POOL_A_NAME || 'Pool A');
  }

  if (!poolAAddress) {
    await redis.set('POOL_A_ADDRESS', process.env.NEXT_PUBLIC_POOL_A_ADDRESS || '');
  }
}

export { initializeConfig };
