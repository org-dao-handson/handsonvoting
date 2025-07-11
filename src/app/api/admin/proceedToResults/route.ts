// src/app/api/admin/proceedToResults/route.ts
import { NextRequest, NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';
import { validateApiKey } from '../../../../utils/authHelpers';

export async function GET(req: NextRequest) {
  // Check for API key using the helper that skips validation in development
  const apiKey = req.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canProceed = await redis.get('proceedToResults') === 'true';
  return NextResponse.json({ canProceed });
}

export async function POST(req: NextRequest) {
  // Check for API key using the helper that skips validation in development
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
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
