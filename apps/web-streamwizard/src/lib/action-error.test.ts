import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { z } from "zod";
import { ActionError, toActionError, zodErrorMessage } from "./action-error";

// reportError logs through console.error before it hands off to Sentry, which
// is a no-op here (never initialised). Spying on the console shows whether the
// error was reported without mocking @repo/sentry for every other test file.
const consoleError = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => consoleError.mockClear());

describe("toActionError", () => {
  it("returns the fallback for a Supabase error and reports it", () => {
    const supabaseError = { message: 'duplicate key value violates unique constraint "scenes_pkey"', code: "23505" };
    const message = toActionError(supabaseError, "overlays.save", "Couldn't save your overlay. Try again?");

    expect(message).toBe("Couldn't save your overlay. Try again?");
    expect(message).not.toContain("constraint");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toBe("[overlays.save]");
  });

  it("returns the fallback for a thrown Error", () => {
    const message = toActionError(new Error("Request failed with status code 401"), "vods.list", "Couldn't load your videos.");
    expect(message).toBe("Couldn't load your videos.");
  });

  it("passes the context through to the report", () => {
    toActionError(new Error("boom"), "clips.folder", "Couldn't do that.", { folderId: "f1" });
    expect(consoleError.mock.calls[0]?.[1]).toEqual({ folderId: "f1" });
  });

  it("keeps an ActionError's own message and does not report it", () => {
    const message = toActionError(new ActionError("You can have up to 5 keys."), "keys.create", "Couldn't add a key.");
    expect(message).toBe("You can have up to 5 keys.");
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("zodErrorMessage", () => {
  it("returns the first issue's message, not Zod's JSON dump", () => {
    const parsed = z.object({ name: z.string().min(1, "Name is required") }).safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodErrorMessage(parsed.error, "Invalid input")).toBe("Name is required");
  });

  it("falls back when there are no issues", () => {
    expect(zodErrorMessage({ issues: [] }, "Invalid input")).toBe("Invalid input");
  });
});
