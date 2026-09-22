"use client";

import { analyticsCaptureUrl, analyticsEnabled } from "@/lib/analytics.mjs";
import { useEffect } from "react";

function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!analyticsEnabled(key) || typeof window === "undefined") return;
  navigator.sendBeacon?.(
    analyticsCaptureUrl(window.location.origin),
    new Blob(
      [
        JSON.stringify({
          api_key: key,
          event,
          properties: {
            $current_url: location.href,
            path: location.pathname,
            idea_slug: "nostrborg",
            ...properties,
          },
        }),
      ],
      { type: "application/json" }
    )
  );
}

export function PostHogPageview() {
  useEffect(() => {
    track("$pageview");
  }, []);

  return null;
}

export function captureEvent(event: string, properties: Record<string, string | number | boolean> = {}) {
  track(event, properties);
}
