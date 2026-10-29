import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { CaptureResult } from "posthog-js";
import { scrubEvent } from "./scrub";

// scrubUrl resolves relative URLs against the page; a bare origin is enough.
beforeAll(() => {
  (globalThis as { window?: unknown }).window = { location: { origin: "https://streamwizard.org" } };
});
// bun runs every test file in one process: don't leave a fake window behind.
afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

const TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

function event(properties: Record<string, unknown>): CaptureResult {
  return { uuid: "1", event: "$pageview", properties } as CaptureResult;
}

describe("scrubEvent", () => {
  it("drops every event fired on a preview page", () => {
    expect(scrubEvent(event({ $current_url: `https://streamwizard.org/preview/${TOKEN}` }))).toBeNull();
    expect(scrubEvent(event({ $pathname: `/preview/${TOKEN}` }))).toBeNull();
  });

  it("masks a preview token in the referrer of a later page", () => {
    const scrubbed = scrubEvent(
      event({
        $current_url: "https://streamwizard.org/pricing",
        $referrer: `https://streamwizard.org/preview/${TOKEN}`,
      }),
    );
    expect(scrubbed?.properties.$referrer).toBe("https://streamwizard.org/preview/[token]");
  });

  it("masks a preview token anywhere in a later event, nested or in person properties", () => {
    const scrubbed = scrubEvent({
      ...event({
        $current_url: "https://streamwizard.org/pricing",
        $prev_pageview_pathname: `/preview/${TOKEN}`,
        $web_vitals_LCP_event: {
          attribution: { navigationURL: `http://localhost:3000/preview/${TOKEN}` },
          entries: [],
        },
      }),
      $set_once: { $initial_current_url: `https://streamwizard.org/preview/${TOKEN}` },
    });
    expect(JSON.stringify(scrubbed)).not.toContain(TOKEN);
    expect(scrubbed?.properties.$prev_pageview_pathname).toBe("/preview/[token]");
    expect(scrubbed?.$set_once?.$initial_current_url).toBe("https://streamwizard.org/preview/[token]");
  });

  it("still strips credential query params", () => {
    const scrubbed = scrubEvent(
      event({ $current_url: "https://streamwizard.org/auth/callback?code=secret&next=/dashboard" }),
    );
    expect(scrubbed?.properties.$current_url).toBe("https://streamwizard.org/auth/callback?next=%2Fdashboard");
  });

  it("leaves other pages alone", () => {
    const scrubbed = scrubEvent(
      event({ $current_url: "https://streamwizard.org/blog/hello", $pathname: "/blog/hello" }),
    );
    expect(scrubbed?.properties).toEqual({
      $current_url: "https://streamwizard.org/blog/hello",
      $pathname: "/blog/hello",
    });
  });
});
