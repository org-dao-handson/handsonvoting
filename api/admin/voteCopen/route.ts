import { NextResponse } from 'next/server';

let voteCopen = true;

export function GET() {
  return NextResponse.json({ voteCopen });
}

export function POST() {
  voteCopen = false;
  return NextResponse.json({ voteCopen });
}
