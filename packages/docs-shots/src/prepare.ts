/**
 * Everything that has to be true before a page is worth photographing:
 * no live socket, no cookie banner, no motion, no platform scrollbars.
 *
 * All of it goes in via addInitScript rather than addScriptTag. buildCsp in
 * apps/web-streamwizard/src/lib/csp.ts emits `script-src 'self' 'nonce-…'`
 * with no 'unsafe-inline', so an injected <script> element is blocked;
 * addInitScript and evaluate run through CDP and are not.
 */

/**
 * Replace WebSocket before any app code runs.
 *
 * Every ws-backed widget subscribes through subscribeToWsRoom, and the IRL
 * field widgets have no browser-event path at all, so faking the socket is the
 * only way to drive them. It also removes reconnect jitter and the
 * connecting/connected flicker from every shot at once.
 */
export const FAKE_WEBSOCKET = `
(() => {
  const Native = window.WebSocket;
  // Only the overlay's own socket is faked. Next's dev server runs HMR over a
  // WebSocket of its own, and swallowing that one stops the page hydrating at
  // all, so anything that is not an overlay room goes to the real class.
  const isOverlaySocket = (url) =>
    typeof url === "string" && /[?&]role=(subscriber|publisher)\\b/.test(url);

  class ShotSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor(url, protocols) {
      if (!isOverlaySocket(url)) return new Native(url, protocols);
      this.url = url;
      this.readyState = 1;
      this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
      queueMicrotask(() => {
        window.__shotSockets.push(this);
        if (this.onopen) this.onopen({ type: "open" });
      });
    }
    send() {}
    close() { this.readyState = 3; if (this.onclose) this.onclose({ type: "close" }); }
    addEventListener(type, fn) { this["on" + type] = fn; }
    removeEventListener(type) { this["on" + type] = null; }
  }
  ShotSocket.prototype.CONNECTING = 0; ShotSocket.prototype.OPEN = 1;
  ShotSocket.prototype.CLOSING = 2; ShotSocket.prototype.CLOSED = 3;

  window.__shotSockets = [];
  /** Deliver one {type, payload} frame to every open overlay socket. */
  window.__shotWsEmit = (frame) => {
    const data = JSON.stringify(frame);
    for (const s of window.__shotSockets) if (s.onmessage) s.onmessage({ data });
  };
  window.WebSocket = ShotSocket;
})();
`;

/**
 * The cookie banner reads navigator.globalPrivacyControl and dismisses itself
 * when it is set. Declining that way saves a click, a toast, and the toast's
 * own dismissal timer on every single shot.
 */
export const DECLINE_COOKIES = `
Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true });
`;

export function pinTheme(theme: "dark" | "light"): string {
  return `try { window.localStorage.setItem("theme", ${JSON.stringify(theme)}); } catch {}`;
}

/**
 * Belt and braces over the context's reducedMotion. Caret included: a blinking
 * text cursor in a focused field is a one-pixel diff that never settles.
 */
export const FREEZE_STYLES = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  ::-webkit-scrollbar { display: none !important; }
`;
