import { NextResponse } from 'next/server';

let voteBopen = true;

export function GET() {
  return NextResponse.json({ voteBopen });
}

export function POST() {
  voteBopen = false;
  return NextResponse.json({ voteBopen });
}
