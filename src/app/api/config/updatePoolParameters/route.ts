// src/app/api/config/updatePoolParameters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { poolAName, poolAAddress } = body;

    // Update values in Redis if provided
    if (poolAName !== undefined) {
      await redis.set('POOL_A_NAME', poolAName);
    }

    if (poolAAddress !== undefined) {
      await redis.set('POOL_A_ADDRESS', poolAAddress);
    }

    // Return the updated values
    return NextResponse.json({
      success: true,
      poolAName: await redis.get('POOL_A_NAME'),
      poolAAddress: await redis.get('POOL_A_ADDRESS')
    });
  } catch (error) {
    console.error('Failed to update pool parameters:', error);
    return NextResponse.json(
      { message: 'Failed to update pool parameters' },
      { status: 500 }
    );
  }
}
