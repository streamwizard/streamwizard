import { describe, expect, it } from "bun:test";
import { createChatCommandCounter } from "./trackChatCommand";

function setup() {
  const sent: { broadcasterId: string; commandType: string; command: string | null; count: number }[] = [];
  let now = 0;
  const counter = createChatCommandCounter({
    now: () => now,
    send: ({ broadcasterId, commandType, command, count }) =>
      void sent.push({ broadcasterId, commandType, command, count }),
  });
  return { sent, counter, advance: (ms: number) => (now += ms) };
}

const MINUTE = 60_000;

describe("createChatCommandCounter", () => {
  it("sends one event per channel and command with the number of uses", async () => {
    const { sent, counter, advance } = setup();
    for (let i = 0; i < 250; i++) counter.record("chan-1", "default", "!uptime");
    await counter.flush();
    expect(sent).toHaveLength(0);

    advance(5 * MINUTE);
    await counter.flush();
    expect(sent).toEqual([{ broadcasterId: "chan-1", commandType: "default", command: "!uptime", count: 250 }]);
  });

  it("keeps channels and commands apart", async () => {
    const { sent, counter, advance } = setup();
    counter.record("chan-1", "default", "!uptime");
    counter.record("chan-1", "default", "!followage");
    counter.record("chan-2", "default", "!uptime");
    advance(5 * MINUTE);
    await counter.flush();
    expect(sent).toHaveLength(3);
  });

  it("adds a channel's custom commands together and never sends their names", async () => {
    const { sent, counter, advance } = setup();
    counter.record("chan-1", "custom", "!my-secret-giveaway");
    counter.record("chan-1", "custom", "!discord");
    advance(5 * MINUTE);
    await counter.flush();
    expect(sent).toEqual([{ broadcasterId: "chan-1", commandType: "custom", command: null, count: 2 }]);
  });

  it("starts a fresh window after one is sent, so no use is counted twice or lost", async () => {
    const { sent, counter, advance } = setup();
    counter.record("chan-1", "default", "!uptime");
    advance(5 * MINUTE);
    await counter.flush();
    counter.record("chan-1", "default", "!uptime");
    counter.record("chan-1", "default", "!uptime");
    advance(5 * MINUTE);
    await counter.flush();
    expect(sent.map((event) => event.count)).toEqual([1, 2]);
  });

  it("sends everything still open on shutdown", async () => {
    const { sent, counter } = setup();
    counter.record("chan-1", "default", "!uptime");
    await counter.flush(true);
    expect(sent).toHaveLength(1);
    expect(counter.openWindows).toBe(0);
  });

  it("stays bounded when fed endless keys", async () => {
    const { sent, counter } = setup();
    for (let i = 0; i < 6000; i++) counter.record(`chan-${i}`, "custom", "!x");
    expect(counter.openWindows).toBeLessThanOrEqual(5000);
    await counter.flush(true);
    expect(sent).toHaveLength(6000);
  });
});
