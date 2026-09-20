"use client";

import { shouldSuppressInstallPrompt } from "@/lib/pwaInstall.mjs";
import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallPromptProps = {
  appName: string;
  reason: string;
  storageKey?: string;
};

function emptySubscribe() {
  return () => {};
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export function PwaInstallPrompt({
  appName,
  reason,
  storageKey = "pwa-install-dismissed-at",
}: PwaInstallPromptProps) {
  const standalone = useSyncExternalStore(emptySubscribe, isStandaloneMode, () => false);
  const iosSafari = useSyncExternalStore(emptySubscribe, isIosSafari, () => false);
  const dismissedAt = useSyncExternalStore(
    emptySubscribe,
    () => {
      const raw = Number(window.localStorage.getItem(storageKey));
      return Number.isFinite(raw) ? raw : null;
    },
    () => null
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      localStorage.setItem(storageKey, String(Date.now()));
      setDeferredPrompt(null);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [storageKey]);

  const suppressed = shouldSuppressInstallPrompt({
    isStandalone: standalone,
    dismissedAt,
  });
  const showIosHelp = iosSafari && !standalone;
  const visible = !hidden && !suppressed && (Boolean(deferredPrompt) || showIosHelp);

  const dismiss = () => {
    localStorage.setItem(storageKey, String(Date.now()));
    setHidden(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    localStorage.setItem(storageKey, String(Date.now()));
    setHidden(true);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <section className="card" style={{ position: "relative", marginBottom: 16 }}>
      <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="btn" style={{ position: "absolute", top: 10, right: 10, minHeight: 44, minWidth: 44, padding: 0 }}>
        ×
      </button>
      <h2 style={{ margin: "0 44px 6px 0", fontSize: 18 }}>Add {appName} to your home screen</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>{reason}</p>
      {showIosHelp && !deferredPrompt ? (
        <p style={{ margin: 0 }}>On iPhone: tap Share, then Add to Home Screen.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={install} className="btn btn-primary">
            Add app
          </button>
          <button type="button" onClick={dismiss} className="btn">
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
