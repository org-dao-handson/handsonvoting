// api/admin/flag/route.ts
import { NextResponse } from 'next/server';
import redis from '../../../lib/redis';

export async function GET() {
  const openA = await redis.get('openA') === 'true';
  return NextResponse.json({ openA });
}

export async function POST() {
  const currentValue = await redis.get('openA') === 'true';
  const newValue = !currentValue;
  await redis.set('openA', String(newValue));
  return NextResponse.json({ openA: newValue });
}