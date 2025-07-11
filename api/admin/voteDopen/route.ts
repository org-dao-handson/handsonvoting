import { NextResponse } from 'next/server';
import redis from '../../../lib/redis';

export async function GET() {
  const voteDopen = await redis.get('voteDopen') === 'true';
  return NextResponse.json({ voteDopen });
}

export async function POST() {
  const currentValue = await redis.get('voteDopen') === 'true';
  const newValue = !currentValue;
  await redis.set('voteDopen', String(newValue));
  return NextResponse.json({ voteDopen: newValue });
}
