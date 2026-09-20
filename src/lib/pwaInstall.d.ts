export const PWA_INSTALL_DISMISS_DAYS: number;

export function shouldSuppressInstallPrompt(input: {
  isStandalone: boolean;
  dismissedAt: number | null;
  now?: number;
  dismissDays?: number;
}): boolean;
