// src/app/api/admin/flag/route.ts
import { NextResponse } from 'next/server';

let approved = false;

export async function GET() {
  return NextResponse.json({ approved });
}

export async function POST() {
  approved = !approved;
  return NextResponse.json({ ok: true, approved });
}
