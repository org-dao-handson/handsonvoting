// src/app/api/admin/proceedToVoting/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET() {
  const canProceed = await redis.get('proceedToVoting') === 'true';
  return NextResponse.json({ canProceed });
}

export async function POST() {
  const currentValue = await redis.get('proceedToVoting') === 'true';
  const newValue = !currentValue;
  await redis.set('proceedToVoting', String(newValue));
  return NextResponse.json({ canProceed: newValue });
}
