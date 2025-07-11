// src/app/api/config/initialize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';
import { validateApiKey } from '../../../../utils/authHelpers';

export async function POST(req: NextRequest) {
  // Check for API key using the helper that skips validation in development
  const apiKey = req.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if pool parameters already exist
    const poolName = await redis.get('POOL_NAME');
    const poolAddress = await redis.get('POOL_ADDRESS');

    // Initialize with environment variables if not set
    if (!poolName) {
      await redis.set('POOL_NAME', process.env.NEXT_PUBLIC_POOL_NAME || process.env.NEXT_PUBLIC_POOL_A_NAME || 'Pool');
    }

    if (!poolAddress) {
      await redis.set('POOL_ADDRESS', process.env.NEXT_PUBLIC_POOL_ADDRESS || process.env.NEXT_PUBLIC_POOL_A_ADDRESS || '');
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration initialized',
      poolName: await redis.get('POOL_NAME'),
      poolAddress: await redis.get('POOL_ADDRESS')
    });
  } catch (error) {
    console.error('Error in initialize POST:', error);
    return NextResponse.json(
      { error: 'Failed to initialize configuration' },
      { status: 500 }
    );
  }
}
