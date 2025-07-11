// src/app/api/config/initialize/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function POST() {
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
      message: 'Configuration initialized'
    });
  } catch (error) {
    console.error('Failed to initialize configuration:', error);
    return NextResponse.json(
      { message: 'Failed to initialize configuration' },
      { status: 500 }
    );
  }
}
