// Realtime signals from GET /api/notifications/stream (server-sent events). fetch() is used instead of
// EventSource so the token travels in the Authorization header, never in the URL.
import { API_BASE_URL, tokenStore } from './apiClient';

export type NotificationStreamEvent = 'notification' | 'sync';

const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;

/**
 * Keeps one stream open and calls `onEvent` for every signal; reconnects with a growing delay when
 * the connection drops. `onEvent('sync')` is also called after each reconnect, since signals may
 * have been missed meanwhile. Returns a function that closes the stream for good.
 */
export function startNotificationStream(onEvent: (event: NotificationStreamEvent) => void): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: number | undefined;
  let delay = MIN_RETRY_MS;
  let connectedOnce = false;

  const scheduleRetry = () => {
    if (stopped) return;
    retryTimer = window.setTimeout(connect, delay);
    delay = Math.min(delay * 2, MAX_RETRY_MS);
  };

  const connect = async () => {
    const token = tokenStore.get();
    if (stopped || !token) return;
    controller = new AbortController();
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/stream`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: 'no-store'
      });
      // 401/403: the session is over; the regular API calls handle signing out.
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      delay = MIN_RETRY_MS;
      if (connectedOnce) onEvent('sync');
      connectedOnce = true;

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        // Events are separated by a blank line; lines starting with ":" are keep-alive comments.
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const name = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
          if (name === 'notification' || name === 'sync') onEvent(name);
        }
      }
    } catch {
      // Network error or aborted: retry below unless stopped.
    }
    scheduleRetry();
  };

  void connect();
  return () => {
    stopped = true;
    window.clearTimeout(retryTimer);
    controller?.abort();
  };
}
