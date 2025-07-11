// src/app/api/config/getPoolParameters/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET() {
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
