// lib/redis.ts
import Redis from 'ioredis';

// Connect to Redis using environment variable or default to localhost for dev
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// Add error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Optional: Add connection success logging
redis.on('connect', () => {
  console.log('Connected to Redis');
});

export default redis;