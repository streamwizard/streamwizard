// Safe summaries of HTTP client errors for logs and Sentry.
//
// An axios error carries the whole request: `config` (params, headers, body)
// and `request` (the raw socket, headers included). Logging or reporting the
// error object prints all of that. These helpers keep only what says what
// failed: method, path, status, error code and the error fields of the
// response body.
//
// Axios is detected by shape (`isAxiosError: true`), so this package doesn't
// depend on axios and works for any copy of it in the workspace.

const FIELD_MAX = 200;

type HttpClientErrorLike = Error & {
  isAxiosError: true;
  code?: unknown;
  config?: { method?: unknown; url?: unknown; baseURL?: unknown };
  response?: { status?: unknown; statusText?: unknown; data?: unknown };
};

/** True for axios errors (any axios version or copy). */
export function isHttpClientError(error: unknown): error is HttpClientErrorLike {
  return error instanceof Error && (error as { isAxiosError?: unknown }).isAxiosError === true;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return value.length > FIELD_MAX ? `${value.slice(0, FIELD_MAX)}…` : value;
}

/** The request path without query string or fragment; never the host. */
function requestPath(url: unknown, baseURL: unknown): string {
  if (typeof url !== "string" || url === "") return "?";
  // Joined the way axios does: a relative url is appended to baseURL.
  const absolute = /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
  const full =
    !absolute && typeof baseURL === "string" && baseURL !== ""
      ? `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`
      : url;
  try {
    return new URL(full, "http://relative.invalid").pathname;
  } catch {
    return full.replace(/^([a-z][a-z\d+\-.]*:)?\/\/[^/]*/i, "").split(/[?#]/)[0] || "/";
  }
}

/** Twitch (and most JSON APIs) answer errors with `{ error, message }`. */
function responseFields(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const { error, message } = data as { error?: unknown; message?: unknown };
  const parts = [text(error), text(message)].filter(Boolean);
  return parts.length ? parts.join(": ") : undefined;
}

function describeHttpClientError(error: HttpClientErrorLike): string {
  const method = typeof error.config?.method === "string" ? error.config.method.toUpperCase() : "?";
  const path = requestPath(error.config?.url, error.config?.baseURL);
  const status = typeof error.response?.status === "number" ? error.response.status : undefined;
  const code = text(error.code);

  let line = `${method} ${path} -> ${status ?? code ?? "no response"}`;
  const fields = responseFields(error.response?.data);
  if (fields) line += ` (${fields})`;
  // Axios's own "Request failed with status code N" adds nothing to the status;
  // anything else (timeouts, DNS, a message set by our own code) is kept.
  const message = text(error.message);
  if (message && !/^Request failed with status code \d+$/.test(message)) line += ` ${message}`;
  return line;
}

/**
 * One line that says what went wrong, safe to log. For an axios error:
 * `POST /oauth2/token -> 400 (Invalid refresh token)`. For any other Error:
 * `Name: message`. Never includes request config, params, headers or bodies.
 */
export function describeError(error: unknown): string {
  if (isHttpClientError(error)) return `${error.name}: ${describeHttpClientError(error)}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  // Error-shaped values that aren't Error instances, like Supabase's { code, message }.
  if (error !== null && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const msg = text(message);
    if (msg) return text(code) ? `${text(code)}: ${msg}` : msg;
  }
  return text(String(error)) ?? "unknown error";
}

/**
 * For reportError / captureException: an axios error becomes a plain Error with
 * describeError's summary and the original stack, so nothing from the request
 * reaches the console or Sentry. Every other value is returned unchanged.
 */
export function toSafeError(error: unknown): unknown {
  if (!isHttpClientError(error)) return error;
  const safe = new Error(describeHttpClientError(error));
  safe.name = error.name;
  if (error.stack) {
    // The first stack line repeats the original message; the frames are kept.
    const frames = error.stack.split("\n").slice(1).join("\n");
    safe.stack = frames ? `${safe.name}: ${safe.message}\n${frames}` : `${safe.name}: ${safe.message}`;
  }
  return safe;
}
