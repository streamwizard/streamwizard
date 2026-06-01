const PII_STRING_KEYS = new Set([
  "user_name",
  "user_login",
  "broadcaster_user_name",
  "broadcaster_user_login",
  "moderator_user_name",
  "moderator_user_login",
  "from_broadcaster_user_name",
  "from_broadcaster_user_login",
  "to_broadcaster_user_name",
  "to_broadcaster_user_login",
  "creator_name",
  "chatter_user_name",
  "chatter_user_login",
]);

const GEO_KEYS = new Set([
  "latitude",
  "longitude",
  "altitude",
]);

const REDACT_KEYS = new Set([
  "message",
  "text",
  "notice_message",
  "input",
]);

const SECRET_KEYS = new Set([
  "token",
  "secret",
  "password",
  "authorization",
]);

function maskName(name: string): string {
  if (!name || name.length === 0) return "***";
  return name[0] + "***";
}

export function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== "object") return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key)) continue;

    if (GEO_KEYS.has(key)) {
      result[key] = "[redacted]";
    } else if (REDACT_KEYS.has(key)) {
      result[key] = "[redacted]";
    } else if (PII_STRING_KEYS.has(key) && typeof value === "string") {
      result[key] = maskName(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
