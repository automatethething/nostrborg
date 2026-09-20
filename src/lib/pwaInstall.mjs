export const PWA_INSTALL_DISMISS_DAYS = 30;

export function shouldSuppressInstallPrompt({
  isStandalone,
  dismissedAt,
  now = Date.now(),
  dismissDays = PWA_INSTALL_DISMISS_DAYS,
}) {
  if (isStandalone) return true;
  if (typeof dismissedAt !== "number") return false;

  const dismissMs = dismissDays * 24 * 60 * 60 * 1000;
  return now - dismissedAt < dismissMs;
}
