// File: pages/api/admin/voteAopen.ts
import { NextResponse } from 'next/server';
import redis from '../../../lib/redis';

export async function GET() {
  const voteAopen = await redis.get('voteAopen') === 'true';
  return NextResponse.json({ voteAopen });
}

export async function POST() {
  const currentValue = await redis.get('voteAopen') === 'true';
  const newValue = !currentValue;
  await redis.set('voteAopen', String(newValue));
  return NextResponse.json({ voteAopen: newValue });
}