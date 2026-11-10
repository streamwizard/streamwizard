import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { reportError } from "./index";
import { describeError, isHttpClientError, toSafeError } from "./safe-error";

// Built from parts so Bun's source preview in an inspected stack can't contain them.
const SECRET = ["client", "secret", "must", "not", "leak"].join("-");
const REFRESH = ["refresh", "token", "must", "not", "leak"].join("-");
const USER_TOKEN = ["user", "token", "must", "not", "leak"].join("-");

/** Same shape axios builds: the request config, the raw request and the response. */
function fakeAxiosError(overrides: Record<string, unknown> = {}) {
  const error = new Error("Request failed with status code 400") as Error & Record<string, unknown>;
  error.name = "AxiosError";
  Object.assign(error, {
    isAxiosError: true,
    code: "ERR_BAD_REQUEST",
    config: {
      method: "post",
      url: "https://id.twitch.tv/oauth2/token?grant_type=refresh_token",
      params: { client_id: "client-id", client_secret: SECRET, refresh_token: REFRESH },
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
      data: JSON.stringify({ client_secret: SECRET }),
    },
    request: { _header: `POST /oauth2/token HTTP/1.1\r\nAuthorization: Bearer ${USER_TOKEN}` },
    response: {
      status: 400,
      statusText: "Bad Request",
      data: { status: 400, message: "Invalid refresh token" },
      headers: {},
    },
    ...overrides,
  });
  return error;
}

function expectNoSecrets(value: string) {
  expect(value).not.toContain(SECRET);
  expect(value).not.toContain(REFRESH);
  expect(value).not.toContain(USER_TOKEN);
}

describe("describeError", () => {
  it("keeps method, path, status and the Twitch message of an axios error", () => {
    const line = describeError(fakeAxiosError());
    expect(line).toBe("AxiosError: POST /oauth2/token -> 400 (Invalid refresh token)");
    expectNoSecrets(line);
  });

  it("joins a relative url to baseURL and drops the query string", () => {
    const line = describeError(
      fakeAxiosError({
        config: { method: "get", baseURL: "https://api.twitch.tv/helix", url: "/videos?user_id=1&first=20" },
        response: { status: 401, data: { error: "Unauthorized", status: 401, message: "Invalid OAuth token" } },
      }),
    );
    expect(line).toBe("AxiosError: GET /helix/videos -> 401 (Unauthorized: Invalid OAuth token)");
  });

  it("keeps the code and message when there is no response", () => {
    const error = fakeAxiosError({ code: "ECONNABORTED", response: undefined });
    error.message = "timeout of 5000ms exceeded";
    expect(describeError(error)).toBe("AxiosError: POST /oauth2/token -> ECONNABORTED timeout of 5000ms exceeded");
  });

  it("keeps a message our own code set on the error", () => {
    const error = fakeAxiosError({ response: { status: 429, data: {} } });
    error.message = "Twitch rate limit reached (GET /clips); bucket resets at unknown";
    expect(describeError(error)).toBe(
      "AxiosError: POST /oauth2/token -> 429 Twitch rate limit reached (GET /clips); bucket resets at unknown",
    );
  });

  it("ignores response bodies that aren't error objects and cuts long fields", () => {
    expect(describeError(fakeAxiosError({ response: { status: 502, data: "<html>bad gateway</html>" } }))).toBe(
      "AxiosError: POST /oauth2/token -> 502",
    );
    const long = describeError(fakeAxiosError({ response: { status: 400, data: { message: "x".repeat(500) } } }));
    expect(long.length).toBeLessThan(260);
  });

  it("describes other errors and values by name and message", () => {
    expect(describeError(new TypeError("boom"))).toBe("TypeError: boom");
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(undefined)).toBe("undefined");
    expect(describeError({ code: "PGRST116", message: "no rows", details: "x" })).toBe("PGRST116: no rows");
  });
});

describe("isHttpClientError", () => {
  it("matches only errors axios marked", () => {
    expect(isHttpClientError(fakeAxiosError())).toBe(true);
    expect(isHttpClientError(new Error("x"))).toBe(false);
    expect(isHttpClientError({ isAxiosError: true })).toBe(false);
  });
});

describe("toSafeError", () => {
  it("replaces an axios error with a plain Error that has no request detail", () => {
    const original = fakeAxiosError();
    const safe = toSafeError(original) as Error;
    expect(safe).not.toBe(original);
    expect(safe).toBeInstanceOf(Error);
    expect(safe.name).toBe("AxiosError");
    expect(safe.message).toBe("POST /oauth2/token -> 400 (Invalid refresh token)");
    for (const key of ["config", "request", "response", "code"]) expect(key in safe).toBe(false);
    expectNoSecrets(Bun.inspect(safe));
    expectNoSecrets(JSON.stringify(safe));
  });

  it("returns every other value unchanged", () => {
    const error = new Error("db down");
    expect(toSafeError(error)).toBe(error);
    expect(toSafeError("x")).toBe("x");
  });
});

describe("reportError", () => {
  let consoleError: ReturnType<typeof spyOn> | undefined;
  afterEach(() => consoleError?.mockRestore());

  it("never logs the request of an axios error", () => {
    const logged: unknown[][] = [];
    consoleError = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    reportError(fakeAxiosError(), "twitch-api.token-refresh", { broadcasterId: "123" });
    expect(logged).toHaveLength(1);
    const output = logged[0]!.map((arg) => Bun.inspect(arg)).join(" ");
    expect(output).toContain("POST /oauth2/token -> 400");
    expect(output).toContain("123");
    expectNoSecrets(output);
  });
});
