"use client";

import { useEffect } from "react";

export function PostHogPageview() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://logs.petrichorlabs.ca";
    if (!key) return;
    navigator.sendBeacon?.(
      `${host}/capture/`,
      new Blob(
        [
          JSON.stringify({
            api_key: key,
            event: "$pageview",
            properties: { $current_url: location.href, path: location.pathname, idea_slug: "nostrborg" },
          }),
        ],
        { type: "application/json" }
      )
    );
  }, []);

  return null;
}

export function captureEvent(event: string, properties: Record<string, string | number | boolean> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://logs.petrichorlabs.ca";
  if (!key || typeof window === "undefined") return;
  navigator.sendBeacon?.(
    `${host}/capture/`,
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
