// src/app/api/admin/voteOpen/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../../../lib/redis';

export async function GET() {
  const voteOpen = await redis.get('voteOpen') === 'true';
  return NextResponse.json({ voteOpen });
}

export async function POST() {
  const currentValue = await redis.get('voteOpen') === 'true';
  const newValue = !currentValue;
  await redis.set('voteOpen', String(newValue));
  return NextResponse.json({ voteOpen: newValue });
}
