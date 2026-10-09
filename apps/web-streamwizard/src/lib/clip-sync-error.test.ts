import { describe, expect, it } from "bun:test";
import { clipSyncErrorMessage } from "./clip-sync-error";

describe("clipSyncErrorMessage", () => {
  it("says the sync could not be reached when there was no answer at all", () => {
    expect(clipSyncErrorMessage(undefined)).toBe("Couldn't reach the clip sync. Give it a minute and try again.");
  });

  it("points at the Twitch connection when the API could not use it", () => {
    expect(clipSyncErrorMessage(404)).toBe("Couldn't load your clips. Check your Twitch connection.");
    expect(clipSyncErrorMessage(400)).toBe(clipSyncErrorMessage(404));
  });

  it("tells a signed-out session to reload", () => {
    expect(clipSyncErrorMessage(401)).toBe("Your session ran out. Reload the page and try again.");
  });

  it("owns up when it is our side that broke", () => {
    expect(clipSyncErrorMessage(500)).toBe("Something broke on our end. Try again?");
    expect(clipSyncErrorMessage(502)).toBe(clipSyncErrorMessage(500));
  });

  it("never falls back to the old catch-all", () => {
    for (const status of [undefined, 400, 401, 404, 429, 500, 503]) {
      expect(clipSyncErrorMessage(status)).not.toContain("Error syncing");
    }
  });
});
