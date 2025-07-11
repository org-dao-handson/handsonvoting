import Redis from 'ioredis';

// Determine connection options based on environment
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Configure Redis client with options for handling SSL certificates
const redisOptions = {
  // Disable certificate validation for Heroku Redis SSL connections
  tls: redisUrl.includes('rediss://') || redisUrl.includes('ssl=true') ? {
    rejectUnauthorized: false
  } : undefined
};

// Connect to Redis with proper options
const redis = new Redis(redisUrl, redisOptions);

// Add error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Optional: Add connection success logging
redis.on('connect', () => {
  console.log('Connected to Redis');
});

export default redis;