// src/app/api/config/updatePoolParameters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';
import { validateApiKey } from '../../../../utils/authHelpers';

export async function POST(request: NextRequest) {
  // Check for API key using the helper that skips validation in development
  const apiKey = request.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse the request body
    const body = await request.json();
    const { poolName, poolAddress } = body;

    // Validate input
    if (poolName === undefined && poolAddress === undefined) {
      return NextResponse.json(
        { error: 'At least one parameter (poolName or poolAddress) must be provided' },
        { status: 400 }
      );
    }

    // Update values in Redis if provided
    if (poolName !== undefined) {
      await redis.set('POOL_NAME', poolName);
    }

    if (poolAddress !== undefined) {
      await redis.set('POOL_ADDRESS', poolAddress);
    }

    // Return the updated values
    return NextResponse.json({
      success: true,
      message: 'Pool parameters updated successfully',
      poolName: await redis.get('POOL_NAME'),
      poolAddress: await redis.get('POOL_ADDRESS')
    });
  } catch (error) {
    console.error('Error in updatePoolParameters POST:', error);
    return NextResponse.json(
      { error: 'Failed to update pool parameters' },
      { status: 500 }
    );
  }
}
