import { NextResponse } from "next/server";

export function GET() {
  console.info(JSON.stringify({ route: "/api/health", ok: true }));
  return NextResponse.json(
    { ok: true, service: "nostrborg" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
