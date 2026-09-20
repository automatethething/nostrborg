import { runRestoreDrill } from "@/lib/restore-drill.mjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST() {
  try {
    const receipt = runRestoreDrill({ blobCount: 4, blobBytes: 4096 });
    console.info(
      JSON.stringify({
        route: "/api/drill",
        ok: true,
        blobs: receipt.blobs,
        elapsedMs: receipt.elapsedMs,
      })
    );
    return NextResponse.json(receipt, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.info(JSON.stringify({ route: "/api/drill", ok: false }));
    return NextResponse.json(
      { ok: false, error: "Restore drill failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
