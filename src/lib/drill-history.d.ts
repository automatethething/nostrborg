export type HistoryStep = { id: string; ok: boolean };

export type HistoryRecord = {
  id: string;
  at: string;
  ok: boolean;
  blobs: number;
  blobBytes: number;
  lostReplica: string;
  survivingReplica: string;
  elapsedMs: number;
  steps: HistoryStep[];
};

export function isUserId(value: unknown): value is string;
export function summarizeReceipt(receipt: unknown, at?: string): HistoryRecord;
export function appendHistory(existing: unknown, summary: HistoryRecord): HistoryRecord[];
export function createMemoryHistoryStore(map?: Map<string, HistoryRecord[]>): {
  get(userId: string): Promise<HistoryRecord[]>;
  set(userId: string, rows: HistoryRecord[]): Promise<void>;
};
