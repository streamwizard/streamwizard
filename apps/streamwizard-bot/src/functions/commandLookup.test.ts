import { describe, expect, it } from "bun:test";
import { createCommandLookup, indexCommands } from "./commandLookup";

type Rows = Parameters<typeof indexCommands>[0];

const cmd = (id: string, command: string, message = `reply ${id}`) => ({ id, command, message, action: null });

const ROWS: Rows = [
  { custom_commands: cmd("c1", "!discord"), default_chat_commands: null },
  { custom_commands: null, default_chat_commands: cmd("d1", "!uptime") },
];

function setup(rows: Rows = ROWS) {
  let now = 0;
  const loads: string[] = [];
  const lookup = createCommandLookup(
    async (channelId) => {
      loads.push(channelId);
      return rows;
    },
    { ttlMs: 60_000, now: () => now },
  );
  return { lookup, loads, advance: (ms: number) => (now += ms) };
}

describe("indexCommands", () => {
  it("keeps the first row for a trigger, and the custom command within a row", () => {
    const index = indexCommands([
      { custom_commands: null, default_chat_commands: cmd("d1", "!x") },
      { custom_commands: cmd("c1", "!x"), default_chat_commands: null },
      { custom_commands: cmd("c2", "!y"), default_chat_commands: cmd("d2", "!y") },
    ]);
    expect(index.get("!x")).toEqual({ source: "default", data: cmd("d1", "!x") });
    expect(index.get("!y")).toEqual({ source: "custom", data: cmd("c2", "!y") });
  });
});

describe("createCommandLookup", () => {
  it("finds custom and default commands", async () => {
    const { lookup } = setup();
    expect(await lookup.find("chan-1", "!discord")).toEqual({ source: "custom", data: cmd("c1", "!discord") });
    expect(await lookup.find("chan-1", "!uptime")).toEqual({ source: "default", data: cmd("d1", "!uptime") });
  });

  it("loads a channel once per TTL, unknown commands included", async () => {
    const { lookup, loads, advance } = setup();
    await lookup.find("chan-1", "!discord");
    for (let i = 0; i < 50; i++) expect(await lookup.find("chan-1", "!othersbot")).toBeNull();
    expect(loads).toEqual(["chan-1"]);

    advance(60_001);
    await lookup.find("chan-1", "!discord");
    expect(loads).toEqual(["chan-1", "chan-1"]);
  });

  it("caches a channel with no commands", async () => {
    const { lookup, loads } = setup([]);
    expect(await lookup.find("chan-1", "!a")).toBeNull();
    expect(await lookup.find("chan-1", "!b")).toBeNull();
    expect(loads).toEqual(["chan-1"]);
  });

  it("keeps channels apart and reloads one after invalidate", async () => {
    const { lookup, loads } = setup();
    await lookup.find("chan-1", "!discord");
    await lookup.find("chan-2", "!discord");
    lookup.invalidate("chan-1");
    await lookup.find("chan-1", "!discord");
    await lookup.find("chan-2", "!discord");
    expect(loads).toEqual(["chan-1", "chan-2", "chan-1"]);
  });

  it("collapses concurrent misses into one load", async () => {
    const { lookup, loads } = setup();
    await Promise.all(Array.from({ length: 10 }, () => lookup.find("chan-1", "!uptime")));
    expect(loads).toEqual(["chan-1"]);
  });

  it("doesn't cache a failed load", async () => {
    let calls = 0;
    const lookup = createCommandLookup(async () => {
      calls++;
      if (calls === 1) throw new Error("supabase unreachable");
      return ROWS;
    });
    await expect(lookup.find("chan-1", "!uptime")).rejects.toThrow("supabase unreachable");
    expect(await lookup.find("chan-1", "!uptime")).toEqual({ source: "default", data: cmd("d1", "!uptime") });
    expect(calls).toBe(2);
  });
});
