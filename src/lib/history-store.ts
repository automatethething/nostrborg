import { createMemoryHistoryStore } from "@/lib/drill-history.mjs";

type HistoryRow = Awaited<ReturnType<ReturnType<typeof createMemoryHistoryStore>["get"]>>[number];

const memory = createMemoryHistoryStore();

export async function getHistoryStore() {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: "nostrborg-history" });
    return {
      async get(userId: string): Promise<HistoryRow[]> {
        const rows = await cache.get(userId);
        return Array.isArray(rows) ? (rows as HistoryRow[]) : [];
      },
      async set(userId: string, rows: HistoryRow[]) {
        await cache.set(userId, rows, {
          ttl: 60 * 60 * 24 * 30,
          tags: ["drill-history", `user:${userId}`],
          name: "drill-history",
        });
      },
    };
  } catch {
    return memory;
  }
}
