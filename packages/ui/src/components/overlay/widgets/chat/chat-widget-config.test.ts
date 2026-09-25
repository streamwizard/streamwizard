import { describe, expect, it } from "bun:test";
import { buildWidgetTestEvent } from "@repo/schemas";
import { chatWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  CHAT_WIDGET_LIMITS,
  chatNoticeKind,
  chatWidgetHorizontalHeight,
  createDefaultChatWidgetConfig,
  normalizeChatWidgetConfig,
  normalizeChatWidgetHiddenUsers,
} from "./chat-widget-config";
import {
  applyChatWidgetFrame,
  capChatWidgetRows,
  pruneChatWidgetRows,
  type ChatWidgetFeedOptions,
  type ChatWidgetRow,
} from "./chat-widget-feed";

function options(overrides: Partial<ChatWidgetFeedOptions> = {}): ChatWidgetFeedOptions {
  const cfg = createDefaultChatWidgetConfig();
  return {
    maxMessages: cfg.maxMessages,
    hiddenUsers: cfg.hiddenUsers,
    hideCommands: cfg.hideCommands,
    showGifs: cfg.showGifs,
    notices: cfg.notices,
    ...overrides,
  };
}

function chatMessage(overrides: Record<string, unknown> = {}, text?: string) {
  const payload = buildWidgetTestEvent("channel.chat.message").payload as Record<string, unknown>;
  const message = payload.message as { text: string; fragments: unknown[] };
  return {
    type: "channel.chat.message",
    payload: {
      ...payload,
      ...overrides,
      message: text === undefined ? message : { text, fragments: [{ type: "text", text }] },
    },
  };
}

function notice(noticeType: string, overrides: Record<string, unknown> = {}) {
  const payload = buildWidgetTestEvent("channel.chat.notification").payload as Record<
    string,
    unknown
  >;
  return {
    type: "channel.chat.notification",
    payload: { ...payload, notice_type: noticeType, ...overrides },
  };
}

function feed(frames: { type: string; payload: unknown }[], opts = options()) {
  return frames.reduce<ChatWidgetRow[]>(
    (rows, frame, i) => applyChatWidgetFrame(rows, frame, opts, 1000 + i),
    [],
  );
}

describe("normalizeChatWidgetConfig", () => {
  it("returns the defaults for empty input", () => {
    expect(normalizeChatWidgetConfig(undefined)).toEqual(createDefaultChatWidgetConfig());
    expect(normalizeChatWidgetConfig({})).toEqual(createDefaultChatWidgetConfig());
  });

  it("clamps numbers and rejects bad enums and colors", () => {
    const cfg = normalizeChatWidgetConfig({
      fontSize: 999,
      maxMessages: 0,
      fadeAfterSeconds: -5,
      backgroundOpacity: 3,
      preset: "neon",
      direction: "sideways",
      layout: "diagonal",
      animationIn: "spin",
      animationOut: "explode",
      textColor: "red",
      fontWeight: 900,
    });
    expect(cfg.fontSize).toBe(CHAT_WIDGET_LIMITS.fontSize.max);
    expect(cfg.maxMessages).toBe(CHAT_WIDGET_LIMITS.maxMessages.min);
    expect(cfg.fadeAfterSeconds).toBe(0);
    expect(cfg.backgroundOpacity).toBe(1);
    expect(cfg.preset).toBe("bubbles");
    expect(cfg.direction).toBe("bottom_up");
    expect(cfg.layout).toBe("vertical");
    expect(cfg.animationIn).toBe("slide_up");
    expect(cfg.animationOut).toBe("fade");
    expect(cfg.textColor).toBe("#ffffff");
    expect(cfg.fontWeight).toBe(500);
  });

  it("keeps partial notice and provider maps, filling the rest", () => {
    const cfg = normalizeChatWidgetConfig({
      notices: { raid: false },
      emoteProviders: { bttv: false },
    });
    expect(cfg.notices.raid).toBe(false);
    expect(cfg.notices.sub).toBe(true);
    expect(cfg.emoteProviders).toEqual({ "7tv": true, bttv: false, ffz: true });
  });

  it("reads animateMove, defaulting to on", () => {
    expect(normalizeChatWidgetConfig({}).animateMove).toBe(true);
    expect(normalizeChatWidgetConfig({ animateMove: false }).animateMove).toBe(false);
    expect(normalizeChatWidgetConfig({ animateMove: "yes" }).animateMove).toBe(true);
  });

  it("keeps an emptied hidden-user list empty", () => {
    expect(normalizeChatWidgetConfig({ hiddenUsers: [] }).hiddenUsers).toEqual([]);
  });
});

describe("chatWidgetItemConfigSchema", () => {
  // Saves go through this schema and keep only what it declares, so a field
  // missing here would silently vanish on save.
  it("keeps every default key on save", () => {
    const cfg = createDefaultChatWidgetConfig();
    expect(chatWidgetItemConfigSchema.parse(cfg)).toEqual(cfg);
  });

  it("fills an empty row with the defaults", () => {
    expect(chatWidgetItemConfigSchema.parse({})).toEqual(createDefaultChatWidgetConfig());
  });
});

describe("normalizeChatWidgetHiddenUsers", () => {
  it("lowercases, strips @, dedupes and drops junk", () => {
    expect(
      normalizeChatWidgetHiddenUsers([" @NightBot ", "nightbot", "bad name", "", 42, "Sery_Bot"]),
    ).toEqual(["nightbot", "sery_bot"]);
  });
});

describe("chatWidgetHorizontalHeight", () => {
  it("fits one line plus padding, with room for emotes", () => {
    const h = chatWidgetHorizontalHeight({ fontSize: 20, preset: "plain", padding: 12 });
    expect(h).toBeGreaterThanOrEqual(Math.ceil(20 * 1.35 + 24));
    expect(h).toBeLessThan(20 * 3 + 24);
  });

  it("gives Card two lines", () => {
    const plain = chatWidgetHorizontalHeight({ fontSize: 20, preset: "plain", padding: 12 });
    const card = chatWidgetHorizontalHeight({ fontSize: 20, preset: "card", padding: 12 });
    expect(card - plain).toBeGreaterThanOrEqual(Math.round(20 * 1.35));
  });

  it("grows with padding and font size", () => {
    const base = chatWidgetHorizontalHeight({ fontSize: 20, preset: "bubbles", padding: 12 });
    expect(chatWidgetHorizontalHeight({ fontSize: 20, preset: "bubbles", padding: 20 })).toBe(base + 16);
    expect(chatWidgetHorizontalHeight({ fontSize: 40, preset: "bubbles", padding: 12 })).toBeGreaterThan(base);
  });
});

describe("chatNoticeKind", () => {
  it("folds Twitch notice types into toggles", () => {
    expect(chatNoticeKind("sub")).toBe("sub");
    expect(chatNoticeKind("prime_paid_upgrade")).toBe("sub");
    expect(chatNoticeKind("resub")).toBe("resub");
    expect(chatNoticeKind("community_sub_gift")).toBe("gift");
    expect(chatNoticeKind("raid")).toBe("raid");
    expect(chatNoticeKind("announcement")).toBe("announcement");
    expect(chatNoticeKind("watch_streak")).toBe("other");
    expect(chatNoticeKind("something_new")).toBe("other");
  });

  it("never shows another channel's shared chat notices", () => {
    expect(chatNoticeKind("shared_chat_raid")).toBeNull();
  });
});

describe("applyChatWidgetFrame", () => {
  it("appends messages and ignores unrelated frames", () => {
    const rows = feed([
      chatMessage({ message_id: "a" }),
      { type: "channel.follow", payload: {} },
      chatMessage({ message_id: "b" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns the same array for frames it ignores", () => {
    const rows = feed([chatMessage({ message_id: "a" })]);
    expect(applyChatWidgetFrame(rows, { type: "channel.raid", payload: {} }, options(), 5)).toBe(
      rows,
    );
    expect(applyChatWidgetFrame(rows, { type: "channel.chat.message" }, options(), 5)).toBe(rows);
  });

  it("drops duplicate ids", () => {
    const rows = feed([chatMessage({ message_id: "a" }), chatMessage({ message_id: "a" })]);
    expect(rows).toHaveLength(1);
  });

  it("caps at maxMessages, keeping the newest", () => {
    const frames = ["a", "b", "c", "d"].map((id) => chatMessage({ message_id: id }));
    const rows = feed(frames, options({ maxMessages: 2 }));
    expect(rows.map((r) => r.id)).toEqual(["c", "d"]);
  });

  it("hides listed users and !commands", () => {
    const rows = feed([
      chatMessage({ message_id: "bot", chatter_user_login: "Nightbot" }),
      chatMessage({ message_id: "cmd" }, "  !uptime"),
      chatMessage({ message_id: "ok" }, "hello"),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ok"]);
  });

  it("shows !commands when the filter is off", () => {
    const rows = feed([chatMessage({ message_id: "cmd" }, "!uptime")], options({ hideCommands: false }));
    expect(rows).toHaveLength(1);
  });

  it("drops GIF messages when GIFs are off", () => {
    const gif = buildWidgetTestEvent("channel.chat.message", undefined, "gif").payload as Record<string, unknown>;
    const frames = [
      { type: "channel.chat.message", payload: { ...gif, message_id: "gif" } },
      chatMessage({ message_id: "ok" }, "hello"),
    ];
    expect(feed(frames).map((r) => r.id)).toEqual(["gif", "ok"]);
    expect(feed(frames, options({ showGifs: false })).map((r) => r.id)).toEqual(["ok"]);
  });

  it("removes a deleted message", () => {
    const rows = feed([
      chatMessage({ message_id: "a" }),
      chatMessage({ message_id: "b" }),
      { type: "channel.chat.message_delete", payload: { message_id: "a" } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("removes every line from a timed-out user", () => {
    const rows = feed([
      chatMessage({ message_id: "a", chatter_user_id: "10" }),
      chatMessage({ message_id: "b", chatter_user_id: "20" }),
      chatMessage({ message_id: "c", chatter_user_id: "10" }),
      { type: "channel.chat.clear_user_messages", payload: { target_user_id: "10" } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("empties on a chat clear", () => {
    const rows = feed([chatMessage({ message_id: "a" }), { type: "channel.chat.clear", payload: {} }]);
    expect(rows).toEqual([]);
  });

  it("shows notices only for switched-on kinds", () => {
    const opts = options({ notices: { ...options().notices, raid: false } });
    const rows = feed(
      [
        notice("resub", { message_id: "n1" }),
        notice("raid", { message_id: "n2" }),
        notice("shared_chat_sub", { message_id: "n3" }),
      ],
      opts,
    );
    expect(rows.map((r) => r.id)).toEqual(["n1"]);
  });
});

describe("pruneChatWidgetRows", () => {
  const rows = feed([chatMessage({ message_id: "a" }), chatMessage({ message_id: "b" })]);

  it("keeps everything when fading is off", () => {
    expect(pruneChatWidgetRows(rows, 1_000_000, 0)).toBe(rows);
  });

  it("drops rows older than the window", () => {
    // Rows arrived at 1000 and 1001.
    expect(pruneChatWidgetRows(rows, 11_001, 10).map((r) => r.id)).toEqual([]);
    expect(pruneChatWidgetRows(rows, 1000 + 10_000, 10).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("capChatWidgetRows", () => {
  it("trims to the new cap", () => {
    const rows = feed(["a", "b", "c"].map((id) => chatMessage({ message_id: id })));
    expect(capChatWidgetRows(rows, 1).map((r) => r.id)).toEqual(["c"]);
  });
});
