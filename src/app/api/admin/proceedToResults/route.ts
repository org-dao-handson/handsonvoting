// src/app/api/admin/proceedToResults/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET() {
  const canProceed = await redis.get('proceedToResults') === 'true';
  return NextResponse.json({ canProceed });
}

export async function POST() {
  const currentValue = await redis.get('proceedToResults') === 'true';
  const newValue = !currentValue;
  await redis.set('proceedToResults', String(newValue));
  return NextResponse.json({ canProceed: newValue });
}
