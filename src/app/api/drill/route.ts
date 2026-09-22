import { optionalAuth } from "@/lib/optional-auth";
import { appendHistory, isUserId, summarizeReceipt } from "@/lib/drill-history.mjs";
import { getHistoryStore } from "@/lib/history-store";
import { runRestoreDrill } from "@/lib/restore-drill.mjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST() {
  try {
    const receipt = runRestoreDrill({ blobCount: 4, blobBytes: 4096 });
    const session = await optionalAuth();
    const userId = session?.user?.id;
    if (typeof userId === "string" && isUserId(userId)) {
      try {
        const store = await getHistoryStore();
        const drills = appendHistory(await store.get(userId), summarizeReceipt(receipt));
        await store.set(userId, drills);
      } catch {
        console.info(JSON.stringify({ route: "/api/drill", history: "skipped" }));
      }
    }
    console.info(
      JSON.stringify({
        route: "/api/drill",
        ok: true,
        blobs: receipt.blobs,
        elapsedMs: receipt.elapsedMs,
        saved: Boolean(userId),
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
