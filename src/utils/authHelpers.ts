// src/utils/authHelpers.ts

/**
 * Helper function to validate API key
 * Skips validation in development environment
 */
export function validateApiKey(apiKey: string | null): boolean {
  // In development mode, bypass API key validation
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, require a valid API key
  return apiKey !== null && apiKey === process.env.API_SECRET_KEY;
}
