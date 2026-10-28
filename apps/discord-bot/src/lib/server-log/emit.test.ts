import { describe, expect, mock, test } from "bun:test";
import type { Guild } from "discord.js";

/**
 * Threads were filtered as if their parent channel were their category, so
 * message text from a thread under an ignored category, inside an open ticket
 * or inside a log channel was copied into the server log anyway.
 */

const OPEN_TICKET = "ticket-chan";
const LOG_CHANNEL = "log-chan";

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("@repo/supabase/queries/identity", () => ({ getUserIdentity: async () => null }));
mock.module("../log-channel/worker", () => ({
  getLogRoutingFor: async () => ({ ignoredChannelIds: ["ignored-cat"] }),
  getLogChannelIds: async () => new Set([LOG_CHANNEL]),
}));
mock.module("../ticket-activity", () => ({
  isOpenTicketChannel: async (_guildId: string, channelId: string) => channelId === OPEN_TICKET,
}));
mock.module("./audit", () => ({ findAuditEntry: async () => null }));

const { isLoggedChannel } = await import("./emit");

const guild = { id: "g", client: {} } as unknown as Guild;
const thread = (parentId: string, categoryId: string | null) => ({ channelId: "thread-1", parentId, categoryId });

describe("isLoggedChannel for threads", () => {
  test("a thread under an ignored category is not logged", async () => {
    expect(await isLoggedChannel(guild, thread("general", "ignored-cat"))).toBe(false);
  });

  test("a thread inside an open ticket channel is not logged", async () => {
    expect(await isLoggedChannel(guild, thread(OPEN_TICKET, "tickets-cat"))).toBe(false);
  });

  test("a thread inside a log channel is not logged", async () => {
    expect(await isLoggedChannel(guild, thread(LOG_CHANNEL, "staff-cat"))).toBe(false);
  });

  test("an ordinary thread still is", async () => {
    expect(await isLoggedChannel(guild, thread("general", "community-cat"))).toBe(true);
  });
});
