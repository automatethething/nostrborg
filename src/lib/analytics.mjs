const DEFAULT_HOST = "https://logs.petrichorlabs.ca";

export function analyticsCaptureUrl(origin = globalThis.location?.origin) {
  if (typeof origin === "string" && origin.startsWith("https://")) {
    return `${origin}/ingest/capture/`;
  }
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
  return `${host.replace(/\/$/, "")}/capture/`;
}

export function analyticsEnabled(key = process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  return typeof key === "string" && key.length > 8;
}
