export type DrillBlob = {
  path: string;
  digest: string;
  size: number;
  body: Uint8Array;
};

export type DrillStep = {
  id: string;
  ok: boolean;
  detail: string;
};

export type DrillReceipt = {
  ok: true;
  blobs: number;
  blobBytes: number;
  lostReplica: "a";
  survivingReplica: "b";
  byteEqual: true;
  elapsedMs: number;
  manifest: Array<{ path: string; digest: string; size: number }>;
  steps: DrillStep[];
};

export function isDigest(value: unknown): value is string;
export function sha256Hex(body: Uint8Array): string;
export function bytesEqual(left: Uint8Array | null | undefined, right: Uint8Array | null | undefined): boolean;
export function putBlob(
  store: Map<string, Uint8Array>,
  digest: string,
  body: Uint8Array
): { status: 200 | 201; sha256: string; size: number };
export function getBlob(store: Map<string, Uint8Array>, digest: string): Uint8Array | null;
export function deleteBlob(store: Map<string, Uint8Array>, digest: string): boolean;
export function createSyntheticBlobs(blobCount?: number, blobBytes?: number): DrillBlob[];
export function runRestoreDrill(options?: { blobCount?: number; blobBytes?: number }): DrillReceipt;
