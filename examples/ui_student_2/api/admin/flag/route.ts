// app/api/admin/flag/route.ts
import { NextResponse } from 'next/server';

let openA = false;

export function GET() {
  return NextResponse.json({ openA });
}

export function POST() {
  openA = !openA;
  return NextResponse.json({ openA });
}
