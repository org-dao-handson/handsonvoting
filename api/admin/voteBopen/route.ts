import { NextResponse } from 'next/server';
import redis from '../../../lib/redis';

export async function GET() {
  const voteBopen = await redis.get('voteBopen') === 'true';
  return NextResponse.json({ voteBopen });
}

export async function POST() {
  const currentValue = await redis.get('voteBopen') === 'true';
  const newValue = !currentValue;
  await redis.set('voteBopen', String(newValue));
  return NextResponse.json({ voteBopen: newValue });
}
