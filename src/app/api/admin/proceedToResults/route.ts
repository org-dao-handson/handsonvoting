// src/app/api/admin/proceedToResults/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';
import { validateApiKey } from '../../../../utils/authHelpers';

export async function GET(req: NextRequest) {
  // For GET requests, we allow client-side access without authentication
  // This enables polling from components
  try {
    const canProceed = await redis.get('proceedToResults') === 'true';
    // Add cache-control headers to prevent caching
    return NextResponse.json(
      { canProceed },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Error in proceedToResults GET:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // For POST requests, we still require authentication
  const apiKey = req.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currentValue = await redis.get('proceedToResults') === 'true';
    const newValue = !currentValue;
    await redis.set('proceedToResults', String(newValue));
    return NextResponse.json({ canProceed: newValue });
  } catch (error) {
    console.error('Error in proceedToResults POST:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
