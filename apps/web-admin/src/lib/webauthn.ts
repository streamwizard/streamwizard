// Small browser-side helpers shared by the passkey UI.

import { useSyncExternalStore } from "react";

/** True when the browser can run a WebAuthn ceremony at all. */
export function supportsPasskeys(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

const noopSubscribe = () => () => {};

/**
 * Hydration-safe read of the browser's passkey support: the server (and the
 * first client render) see `false`, so the passkey UI never flashes on a
 * browser that can't use it, and the markup matches on both sides.
 */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(noopSubscribe, supportsPasskeys, () => false);
}

/** Same idea for the default passkey name, which depends on the UA. */
export function useDefaultPasskeyName(): string {
  return useSyncExternalStore(noopSubscribe, guessPasskeyName, () => "Passkey");
}

/**
 * auth-js wraps DOM exceptions from navigator.credentials in a WebAuthnError
 * whose `name` (and `cause.name`) mirrors the original. A user dismissing the
 * OS prompt surfaces as NotAllowedError; that is not a failure worth a toast.
 */
export function isWebAuthnCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; cause?: { name?: string } };
  return err.name === "NotAllowedError" || err.cause?.name === "NotAllowedError";
}

/** A default friendly name from the UA: "Chrome on Linux", "Safari on macOS". */
export function guessPasskeyName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}
