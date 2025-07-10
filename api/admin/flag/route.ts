export const dynamic = "force-static";
import { NextResponse } from 'next/server';

// Note: With static export, this state won't persist between page loads
// as it's generated at build time only
let openA = false;

export function GET() {
  return NextResponse.json({ openA });
}

export function POST() {
  // This won't actually work in a static export
  // Consider using client-side state management instead
  return NextResponse.json({ message: "Static exports don't support true API routes" });
}