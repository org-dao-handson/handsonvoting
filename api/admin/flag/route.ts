// app/api/admin/flag/route.ts
import { NextResponse } from 'next/server';

let approved = false;

export function GET() {
  return NextResponse.json({ approved });
}

export function POST() {
  approved = true;
  return NextResponse.json({ approved });
}
