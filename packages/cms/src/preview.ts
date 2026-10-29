// Preview link rules that the browser may know too: durations, token shape,
// expiry, and masking a token in a logged URL. Creating and hashing tokens
// needs node:crypto and lives in ./preview-token.

/** How long a preview link may live, in hours. The editor offers these. */
export const PREVIEW_DURATIONS_HOURS = [1, 24, 168] as const;
export type PreviewDurationHours = (typeof PREVIEW_DURATIONS_HOURS)[number];

/** 32 random bytes, base64url: 43 characters. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isPreviewToken(value: string): boolean {
  return TOKEN.test(value);
}

export function isPreviewDuration(hours: number): hours is PreviewDurationHours {
  return (PREVIEW_DURATIONS_HOURS as readonly number[]).includes(hours);
}

export type PreviewState = "active" | "expired" | "revoked";

export function previewState(
  token: { expires_at: string; revoked_at: string | null },
  now: Date = new Date(),
): PreviewState {
  if (token.revoked_at) return "revoked";
  return new Date(token.expires_at).getTime() > now.getTime() ? "active" : "expired";
}

/** "/preview/<token>" anywhere in a string, for scrubbing logs and analytics. */
export const PREVIEW_PATH = /\/preview\/[A-Za-z0-9_-]{8,}/g;

export function redactPreviewPaths(value: string): string {
  return value.replace(PREVIEW_PATH, "/preview/[token]");
}
