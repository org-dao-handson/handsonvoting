// src/app/api/config/getPoolParameters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET(req: NextRequest) {
  // For GET requests, we allow client-side access without authentication
  // This enables client components to fetch pool parameters
  try {
    const poolName = await redis.get('POOL_NAME');
    const poolAddress = await redis.get('POOL_ADDRESS');

    // Add cache-control headers to prevent caching
    return NextResponse.json(
      {
        poolName,
        poolAddress,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error in getPoolParameters GET:', error);
    return NextResponse.json(
      { message: 'Failed to fetch pool parameters' },
      { status: 500 }
    );
  }
}
