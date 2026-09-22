import { auth } from "@/lib/auth";
import { appendHistory, isUserId, summarizeReceipt } from "@/lib/drill-history.mjs";
import { getHistoryStore } from "@/lib/history-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !isUserId(userId)) return null;
  return userId;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const store = await getHistoryStore();
  const drills = await store.get(userId);
  console.info(JSON.stringify({ route: "/api/history", method: "GET", ok: true, count: drills.length }));
  return NextResponse.json({ ok: true, drills }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON body required." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const summary = summarizeReceipt(payload);
    const store = await getHistoryStore();
    const drills = appendHistory(await store.get(userId), summary);
    await store.set(userId, drills);
    console.info(JSON.stringify({ route: "/api/history", method: "POST", ok: true, count: drills.length }));
    return NextResponse.json({ ok: true, drill: summary, drills }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) || 400 : 400;
    return NextResponse.json({ ok: false, error: "Could not save drill." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
