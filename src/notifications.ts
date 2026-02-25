// ---------------------------------------------------------------------------
// OpenBrowserClaw — Push / Browser Notifications
// ---------------------------------------------------------------------------
//
// Uses the Notification API + ServiceWorker.showNotification for persistent
// notifications even when the tab is in the background.
// Handles permission request, notification display, and click-to-focus.

/** Request notification permission if not already granted. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/** Check if notifications are enabled. */
export function isNotificationEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a notification for an assistant response.
 *
 * Uses ServiceWorker notifications when available (works in background),
 * falls back to plain Notification API.
 */
export async function showNotification(
  title: string,
  body: string,
  options?: { tag?: string; icon?: string },
): Promise<void> {
  if (!isNotificationEnabled()) return;

  // Truncate body to avoid very long notifications
  const truncated = body.length > 200 ? body.slice(0, 200) + '…' : body;

  // Clean markdown formatting for notification text
  const cleanBody = truncated
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/`(.+?)`/g, '$1')         // inline code
    .replace(/```[\s\S]*?```/g, '[code block]') // code blocks
    .replace(/^#+\s+/gm, '')           // headings
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .trim();

  const notifOptions: NotificationOptions & { renotify?: boolean } = {
    body: cleanBody,
    icon: options?.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options?.tag || 'obc-response',
    renotify: true,
    silent: false,
  };

  try {
    // Prefer ServiceWorker notification — works even when tab is in background
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, notifOptions);
    } else {
      // Fallback to basic Notification API
      new Notification(title, notifOptions);
    }
  } catch {
    // Fallback to basic Notification API
    try {
      new Notification(title, notifOptions);
    } catch {
      // Notifications not supported — fail silently
    }
  }
}
