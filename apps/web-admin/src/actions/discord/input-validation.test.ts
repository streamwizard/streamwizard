import { beforeEach, describe, expect, mock, test } from "bun:test";

// Every Discord action is a public POST endpoint: bad arguments must come back
// as `{ error }` before the database, the Discord API or the bot is touched.

const touched: string[] = [];
const reported: unknown[] = [];
let admin = true;

/** Records any use, then fails, so a missed parse shows up as a touch. */
function trap(name: string): unknown {
  return new Proxy(() => {}, {
    get: (_target, prop) => {
      touched.push(`${name}.${String(prop)}`);
      return trap(`${name}.${String(prop)}`);
    },
    apply: () => {
      touched.push(`${name}()`);
      throw new Error(`${name} was called`);
    },
  });
}

const realAssertAdmin = await import("@/lib/auth/assert-admin");
mock.module("@/lib/auth/assert-admin", () => ({
  ...realAssertAdmin,
  assertAdmin: async () => {
    if (!admin) throw new Error("Not authorized");
    return "admin-1";
  },
}));

const realSupabaseAdmin = await import("@repo/supabase/next/admin");
mock.module("@repo/supabase/next/admin", () => ({
  ...realSupabaseAdmin,
  supabaseAdmin: trap("supabaseAdmin"),
  createAdminClient: () => trap("adminClient"),
}));

const realDiscordApi = await import("@/lib/discord/api");
mock.module("@/lib/discord/api", () => ({
  ...realDiscordApi,
  requireDiscordContext: () => ({ api: trap("discordApi"), guildId: "100000000000000001" }),
}));

const realBotBridge = await import("@/lib/discord/bot-bridge");
mock.module("@/lib/discord/bot-bridge", () => ({
  ...realBotBridge,
  callBot: async () => {
    touched.push("callBot");
    return { ok: true, data: {} };
  },
}));

const realCache = await import("next/cache");
mock.module("next/cache", () => ({ ...realCache, revalidatePath: () => {} }));

const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({ ...realSentry, reportError: (error: unknown) => void reported.push(error) }));

const { updateTicketCategoryAction, reorderTicketCategoriesAction } = await import("./ticket-config");
const { removeTicketTagAction } = await import("./ticket-tags");
const { closeTicketFromDashboard, changeTicketFromDashboard, searchGuildMembers, lookupDiscordNames, sendTicketReply } =
  await import("./tickets");
const { scheduleAnnouncementAction, deleteAnnouncementAction } = await import("./announcements");
const { deleteBuiltMessageAction } = await import("./messages");
const { unblockVoiceRenameAction } = await import("./voice");
const { saveTicketOpeningMessageAction } = await import("./ticket-design");
const { saveActivitySettings } = await import("./activity");

const VALID_ID = "aaaaaaaa-0000-0000-0000-000000000001";

beforeEach(() => {
  touched.length = 0;
  reported.length = 0;
  admin = true;
});

/** The call answered with a message and touched nothing on the way. */
function expectRefused(result: { error: string | null }) {
  expect(typeof result.error).toBe("string");
  expect(result.error!.length).toBeGreaterThan(0);
  expect(touched).toEqual([]);
  expect(reported).toEqual([]);
}

describe("discord actions refuse bad input before any lookup", () => {
  test("a bad id is 'doesn't exist anymore', not a database query", async () => {
    const result = await updateTicketCategoryAction("not-an-id", {
      name: "Help",
      description: "",
      emoji: null,
      enabled: true,
      discordCategoryId: null,
    });
    expectRefused(result);
    expect(result.error).toContain("doesn't exist anymore");

    expectRefused(await removeTicketTagAction("1; drop table"));
    expectRefused(await deleteAnnouncementAction("../../etc"));
    expectRefused(await deleteBuiltMessageAction(42 as unknown as string));
    expectRefused(await saveTicketOpeningMessageAction("nope", null));
  });

  test("an overlong close reason is refused before the ticket is loaded", async () => {
    const result = await closeTicketFromDashboard(7, "x".repeat(1001));
    expectRefused(result);
    expect(result.error).toBe("Keep the reason under 1000 characters");
  });

  test("ticket numbers, changes and replies are checked first", async () => {
    expectRefused(await closeTicketFromDashboard(-1));
    expectRefused(await changeTicketFromDashboard(7, "constructor" as never, {} as never));
    expectRefused(await changeTicketFromDashboard(7, "members/add", { targetDiscordUserId: "not-a-snowflake" }));
    expectRefused(await sendTicketReply(7, "x".repeat(2001)));
  });

  test("bad snowflakes, dates, orders and settings are refused", async () => {
    expectRefused(await unblockVoiceRenameAction("12345"));
    expectRefused(await scheduleAnnouncementAction(VALID_ID, "next tuesday"));
    expectRefused(await reorderTicketCategoriesAction(Array.from({ length: 201 }, () => VALID_ID)));
    expectRefused(
      await saveActivitySettings({
        trackingEnabled: true,
        trackMessages: true,
        trackReactions: true,
        trackVoice: true,
        voiceIgnoreAfk: true,
        voiceRequireOthers: true,
        ignoredChannelIds: ["not-a-channel"],
      }),
    );
  });

  test("read actions answer with an empty value and nothing reaches Discord", async () => {
    expect(await searchGuildMembers("x".repeat(101))).toEqual([]);
    expect(await lookupDiscordNames("not an array" as unknown as string[])).toEqual({});
    expect(touched).toEqual([]);
    expect(reported).toEqual([]);
  });

  test("control: valid input does reach the database", async () => {
    const result = await removeTicketTagAction(VALID_ID);
    expect(touched.some((use) => use.startsWith("supabaseAdmin"))).toBe(true);
    // The trap throws, which is unexpected: reported, and a generic sentence back.
    expect(result.error).toBe("Couldn't remove the tag. Try again?");
    expect(reported.length).toBe(1);
  });

  test("a refused admin check returns its message and isn't reported", async () => {
    admin = false;
    const result = await removeTicketTagAction(VALID_ID);
    expectRefused(result);
    expect(result.error).toBe("Not authorized");
    expect(await lookupDiscordNames(["100000000000000002"])).toEqual({});
    expect(reported).toEqual([]);
  });
});
