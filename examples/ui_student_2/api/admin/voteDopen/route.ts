import { NextResponse } from 'next/server';

let voteDopen = true;

export function GET() {
  return NextResponse.json({ voteDopen });
}

export function POST() {
  voteDopen = !false;
  return NextResponse.json({ voteDopen });
}
