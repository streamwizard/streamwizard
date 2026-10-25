import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnvContext } from "../types";

let lastScrape: string | null = null;
// Keep every other export real: bun's module mocks are process-wide, and
// other test files import @repo/metrics too.
const realMetrics = await import("@repo/metrics");
mock.module("@repo/metrics", () => ({
  ...realMetrics,
  querySupabaseLastScrape: async () => lastScrape,
}));

const { databaseRules } = await import("./database");

const NOW = new Date("2026-10-25T12:00:00Z");
const ctx = (): EnvContext => ({ env: "prod", now: NOW, supabase: {}, registry: {}, probeResults: new Map() }) as unknown as EnvContext;
const scrapeSilent = () => databaseRules({}).find((r) => r.id === "supabase.scrape_silent")!;
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("supabase.scrape_silent", () => {
  beforeEach(() => {
    lastScrape = null;
  });

  test("fires when nothing was scraped in the 24h window", async () => {
    const breaches = await scrapeSilent().evaluate(ctx());
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ entityId: "supabase", severity: "warn", value: 24 * 3600 });
  });

  test("fires when the last scrape is older than the threshold", async () => {
    lastScrape = minutesAgo(30);
    const breaches = await scrapeSilent().evaluate(ctx());
    expect(breaches).toHaveLength(1);
    expect(breaches[0]?.value).toBe(30 * 60);
  });

  test("stays quiet while scrapes are recent", async () => {
    lastScrape = minutesAgo(2);
    expect(await scrapeSilent().evaluate(ctx())).toEqual([]);
  });
});
