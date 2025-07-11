// src/app/api/config/getPoolParameters/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET() {
  try {
    const poolAName = await redis.get('POOL_A_NAME');
    const poolAAddress = await redis.get('POOL_A_ADDRESS');

    return NextResponse.json({
      poolAName,
      poolAAddress,
    });
  } catch (error) {
    console.error('Failed to fetch pool parameters:', error);
    return NextResponse.json(
      { message: 'Failed to fetch pool parameters' },
      { status: 500 }
    );
  }
}
