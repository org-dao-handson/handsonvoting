import { NextResponse } from 'next/server';
import redis from '../../../lib/redis';

export async function GET() {
  const voteCopen = await redis.get('voteCopen') === 'true';
  return NextResponse.json({ voteCopen });
}

export async function POST() {
  const currentValue = await redis.get('voteCopen') === 'true';
  const newValue = !currentValue;
  await redis.set('voteCopen', String(newValue));
  return NextResponse.json({ voteCopen: newValue });
}
