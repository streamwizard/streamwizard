import { describe, expect, it } from "bun:test";
import {
  createPreviewToken,
  hashPreviewToken,
  isPreviewDuration,
  isPreviewToken,
  previewState,
  redactPreviewPaths,
  toPgBytea,
} from "./preview-token";

describe("preview tokens", () => {
  it("are 43 url-safe characters and unique", () => {
    const a = createPreviewToken();
    const b = createPreviewToken();
    expect(isPreviewToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("rejects anything else as a token", () => {
    expect(isPreviewToken("short")).toBe(false);
    expect(isPreviewToken(`${"a".repeat(42)}/`)).toBe(false);
  });

  it("hash to 32 bytes and format as PostgREST bytea", () => {
    const hash = hashPreviewToken("token");
    expect(hash.length).toBe(32);
    expect(toPgBytea(hash)).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(toPgBytea(hashPreviewToken("token"))).toBe(toPgBytea(hash));
  });

  it("only allow the offered durations", () => {
    expect(isPreviewDuration(24)).toBe(true);
    expect(isPreviewDuration(12)).toBe(false);
  });

  it("know when they stop working", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(previewState({ expires_at: "2026-10-14T13:00:00Z", revoked_at: null }, now)).toBe("active");
    expect(previewState({ expires_at: "2026-10-14T11:00:00Z", revoked_at: null }, now)).toBe("expired");
    expect(previewState({ expires_at: "2026-10-14T13:00:00Z", revoked_at: "2026-10-14T11:30:00Z" }, now)).toBe(
      "revoked",
    );
  });

  it("are redacted from logged URLs", () => {
    const token = createPreviewToken();
    expect(redactPreviewPaths(`https://streamwizard.org/preview/${token}?x=1`)).toBe(
      "https://streamwizard.org/preview/[token]?x=1",
    );
    expect(redactPreviewPaths("/previews/abc")).toBe("/previews/abc");
  });
});
