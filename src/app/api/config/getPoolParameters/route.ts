// src/app/api/config/getPoolParameters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';
import { validateApiKey } from '../../../../utils/authHelpers';

export async function GET(req: NextRequest) {
  // Check for API key using the helper that skips validation in development
  const apiKey = req.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const poolName = await redis.get('POOL_NAME');
    const poolAddress = await redis.get('POOL_ADDRESS');

    return NextResponse.json({
      poolName,
      poolAddress,
    });
  } catch (error) {
    console.error('Failed to fetch pool parameters:', error);
    return NextResponse.json(
      { message: 'Failed to fetch pool parameters' },
      { status: 500 }
    );
  }
}
