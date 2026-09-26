import { describe, expect, it } from "bun:test";
import { buildWidgetTestEvent } from "@repo/schemas";
import { emoteWidgetItemConfigSchema } from "../../../../overlay-schemas";
import { EMPTY_CHAT_ASSETS, type ChatAssets } from "../../../chat/types";
import {
  EMOTE_ANIMATIONS,
  EMOTE_WIDGET_LIMITS,
  burstSize,
  createDefaultEmoteWidgetConfig,
  normalizeEmoteCodes,
  normalizeEmotePicks,
  normalizeEmoteWidgetConfig,
} from "./emote-widget-config";
import { createEmoteEngine, frameOf, type Rng } from "./emote-engine";
import {
  FALLBACK_EMOTE_URL,
  burstEmoteUrls,
  chatMessageAllowed,
  chatMessageEmotes,
  cooldownAllows,
  emoteUrlForCode,
  emoteWidgetEventOf,
} from "./emote-widget-feed";

/** Deterministic rng: a simple LCG, so engine tests don't flake. */
function seeded(seed = 1): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const W = 1920;
const H = 1080;

describe("emote widget config", () => {
  it("defaults survive a schema round trip", () => {
    const defaults = createDefaultEmoteWidgetConfig();
    expect(emoteWidgetItemConfigSchema.parse(defaults)).toEqual(defaults);
    expect(emoteWidgetItemConfigSchema.parse({})).toEqual(defaults);
  });

  it("normalizes junk to a safe shape", () => {
    const cfg = normalizeEmoteWidgetConfig({
      animation: "nope",
      emoteSize: 9999,
      duration: -5,
      maxOnScreen: "lots",
      events: {
        cheer: {
          enabled: false,
          animation: "spiral",
          count: 0,
          emotes: ["Kappa", "Kappa", { code: " PogU ", url: "https://cdn/pogu" }, { code: "Bad", url: "javascript:x" }],
        },
      },
    });
    expect(cfg.animation).toBe("float_up");
    expect(cfg.emoteSize).toBe(EMOTE_WIDGET_LIMITS.emoteSize.max);
    expect(cfg.duration).toBe(EMOTE_WIDGET_LIMITS.duration.min);
    expect(cfg.maxOnScreen).toBe(150);
    expect(cfg.events.cheer).toEqual({
      enabled: false,
      animation: "spiral",
      count: 1,
      emotes: [
        { code: "Kappa", url: "" },
        { code: "PogU", url: "https://cdn/pogu" },
        { code: "Bad", url: "" },
      ],
    });
    expect(cfg.events.follow.enabled).toBe(true);
  });

  it("keeps same-named emotes with different images apart", () => {
    const picks = normalizeEmotePicks([
      { code: "ratJAM", url: "https://cdn/a" },
      { code: "ratJAM", url: "https://cdn/b" },
      { code: "ratJAM", url: "https://cdn/a" },
    ]);
    expect(picks.map((p) => p.url)).toEqual(["https://cdn/a", "https://cdn/b"]);
  });

  it("drops codes with spaces and caps the list", () => {
    const many = Array.from({ length: 50 }, (_, i) => `E${i}`);
    expect(normalizeEmoteCodes(["a b", "", 3, "ok"])).toEqual(["ok"]);
    expect(normalizeEmoteCodes(many)).toHaveLength(EMOTE_WIDGET_LIMITS.emoteCodes);
  });

  it("scales bursts with the event, capped", () => {
    const burst = { count: 10 };
    expect(burstSize(burst, "follow", {})).toBe(10);
    expect(burstSize(burst, "cheer", { bits: 50 })).toBe(10);
    expect(burstSize(burst, "cheer", { bits: 400 })).toBe(20);
    expect(burstSize(burst, "raid", { viewers: 90 })).toBe(30);
    expect(burstSize(burst, "gift", { total: 4 })).toBe(20);
    expect(burstSize({ count: 200 }, "raid", { viewers: 100000 })).toBe(EMOTE_WIDGET_LIMITS.burstMax);
  });
});

describe("emote engine", () => {
  it("spawns, ages and drops particles", () => {
    const engine = createEmoteEngine({ rng: seeded() });
    engine.spawn(["a", "b"], "float_up", 5, { size: 50, duration: 1000 });
    expect(engine.particles).toHaveLength(5);
    expect(engine.particles.map((p) => p.url)).toEqual(["a", "b", "a", "b", "a"]);
    for (let i = 0; i < 20; i++) engine.step(0.1);
    expect(engine.particles).toHaveLength(0);
  });

  it("keeps the newest when over the cap", () => {
    const engine = createEmoteEngine({ max: 3, rng: seeded() });
    engine.spawn(["old"], "rain", 3, { size: 50, duration: 5000 });
    engine.spawn(["new"], "rain", 2, { size: 50, duration: 5000 });
    expect(engine.particles.map((p) => p.url)).toEqual(["old", "new", "new"]);
    engine.setMax(1);
    expect(engine.particles.map((p) => p.url)).toEqual(["new"]);
  });

  it("clamps a huge frame gap to one short step", () => {
    const engine = createEmoteEngine({ rng: seeded() });
    engine.spawn(["a"], "zoom", 1, { size: 50, duration: 5000 });
    engine.step(30);
    expect(engine.particles[0]!.age).toBeCloseTo(0.1);
  });

  it("drops spin under reduced motion", () => {
    const engine = createEmoteEngine({ rng: seeded() });
    engine.spawn(["a"], "rain", 10, { size: 50, duration: 5000, reducedMotion: true });
    expect(engine.particles.every((p) => p.spin === 0)).toBe(true);
  });

  it("every style gives finite frames that stay near the scene", () => {
    for (const style of EMOTE_ANIMATIONS) {
      const engine = createEmoteEngine({ max: 500, rng: seeded(7) });
      engine.spawn(["a"], style, 40, { size: 60, duration: 4000 });
      for (let t = 0; t < 50; t++) {
        for (const p of engine.particles) {
          const f = frameOf(p, W, H);
          for (const v of [f.x, f.y, f.scale, f.alpha, f.rotation]) expect(Number.isFinite(v)).toBe(true);
          expect(f.alpha).toBeGreaterThanOrEqual(0);
          expect(f.alpha).toBeLessThanOrEqual(1);
          // Visible emotes stay within a generous margin of the scene.
          if (f.alpha > 0.05) {
            expect(f.x).toBeGreaterThan(-W * 0.6);
            expect(f.x).toBeLessThan(W * 1.6);
            expect(f.y).toBeGreaterThan(-H * 0.6);
            expect(f.y).toBeLessThan(H * 1.6);
          }
        }
        engine.step(0.1);
      }
    }
  });

  it("float up rises and rain falls", () => {
    const engine = createEmoteEngine({ rng: seeded(3) });
    engine.spawn(["a"], "float_up", 1, { size: 50, duration: 4000 });
    engine.spawn(["b"], "rain", 1, { size: 50, duration: 4000 });
    const [up, down] = engine.particles;
    const start = [frameOf(up!, W, H).y, frameOf(down!, W, H).y];
    engine.step(0.1);
    engine.step(0.1);
    expect(frameOf(up!, W, H).y).toBeLessThan(start[0]!);
    expect(frameOf(down!, W, H).y).toBeGreaterThan(start[1]!);
  });

  it("bounce stays inside the scene", () => {
    const engine = createEmoteEngine({ rng: seeded(5) });
    engine.spawn(["a"], "bounce", 20, { size: 60, duration: 20000 });
    for (let t = 0; t < 150; t++) {
      for (const p of engine.particles) {
        const f = frameOf(p, W, H);
        expect(f.x).toBeGreaterThanOrEqual(p.size / 2 - 0.001);
        expect(f.x).toBeLessThanOrEqual(W - p.size / 2 + 0.001);
        expect(f.y).toBeGreaterThanOrEqual(p.size / 2 - 0.001);
        expect(f.y).toBeLessThanOrEqual(H - p.size / 2 + 0.001);
      }
      engine.step(0.1);
    }
  });

  it("a burst shares one origin", () => {
    const engine = createEmoteEngine({ rng: seeded(9) });
    engine.spawn(["a"], "explosion", 10, { size: 50, duration: 3000, origin: { x: 0.5, y: 0.5 } });
    for (const p of engine.particles) {
      const f = frameOf(p, W, H);
      expect(f.x).toBeCloseTo(W / 2);
      expect(f.y).toBeCloseTo(H / 2);
    }
  });
});

const ASSETS: ChatAssets = {
  ...EMPTY_CHAT_ASSETS,
  thirdPartyEmotes: {
    catJAM: { id: "1", name: "catJAM", provider: "7tv", url_1x: "7tv/1", url_2x: "7tv/2", url_4x: "7tv/4" },
  },
};
const CHANNEL = { wizHype: { url_2x: "own/2", url_4x: "own/4" } };

describe("emote widget feed", () => {
  const cfg = createDefaultEmoteWidgetConfig();
  const emoteMessage = buildWidgetTestEvent("channel.chat.message", undefined, "emotes").payload;

  it("pulls every emote from a chat message, in order", () => {
    const urls = chatMessageEmotes(emoteMessage, ASSETS, cfg);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain("/25/");
  });

  it("matches third-party codes in text", () => {
    const payload = { message: { text: "hi catJAM", fragments: [{ type: "text" as const, text: "hi catJAM" }] } };
    expect(chatMessageEmotes(payload, ASSETS, cfg)).toEqual(["7tv/4"]);
  });

  it("skips blocked emotes and caps per message", () => {
    expect(chatMessageEmotes(emoteMessage, ASSETS, { ...cfg, blockedEmotes: ["Kappa"] })).toHaveLength(2);
    expect(chatMessageEmotes(emoteMessage, ASSETS, { ...cfg, maxPerMessage: 1 })).toHaveLength(1);
  });

  it("hides bots and commands", () => {
    expect(chatMessageAllowed({ chatter_user_login: "Nightbot", message: { text: "hi" } }, cfg)).toBe(false);
    expect(chatMessageAllowed({ chatter_user_login: "viewer", message: { text: "!kappa" } }, cfg)).toBe(false);
    expect(chatMessageAllowed({ chatter_user_login: "viewer", message: { text: "!kappa" } }, { ...cfg, hideCommands: false })).toBe(true);
    expect(chatMessageAllowed({ chatter_user_login: "viewer", message: { text: "hi" } }, cfg)).toBe(true);
  });

  it("cools a chatter down", () => {
    const seen = new Map<string, number>();
    expect(cooldownAllows(seen, "a", 0, 5)).toBe(true);
    expect(cooldownAllows(seen, "a", 4000, 5)).toBe(false);
    expect(cooldownAllows(seen, "b", 4000, 5)).toBe(true);
    expect(cooldownAllows(seen, "a", 5000, 5)).toBe(true);
    expect(cooldownAllows(seen, "a", 5001, 0)).toBe(true);
  });

  it("maps EventSub types to bursts", () => {
    expect(emoteWidgetEventOf("channel.cheer")).toBe("cheer");
    expect(emoteWidgetEventOf("channel.subscription.message")).toBe("resub");
    expect(emoteWidgetEventOf("channel.chat.message")).toBeNull();
  });

  it("resolves codes: channel, then third party, then Twitch globals", () => {
    expect(emoteUrlForCode("wizHype", CHANNEL, ASSETS)).toBe("own/4");
    expect(emoteUrlForCode("catJAM", CHANNEL, ASSETS)).toBe("7tv/4");
    expect(emoteUrlForCode("Kappa", CHANNEL, ASSETS)).toContain("/25/");
    expect(emoteUrlForCode("nope", CHANNEL, ASSETS)).toBeNull();
  });

  it("burst picks: configured, then message, then channel, then Kappa", () => {
    expect(burstEmoteUrls({ emotes: [{ code: "catJAM", url: "" }] }, {}, CHANNEL, ASSETS)).toEqual(["7tv/4"]);
    expect(burstEmoteUrls({ emotes: [{ code: "x", url: "https://picked" }] }, {}, CHANNEL, ASSETS)).toEqual(["https://picked"]);
    const resub = { message: { text: "love it catJAM", emotes: [{ id: "123" }] } };
    const fromMessage = burstEmoteUrls({ emotes: [] }, resub, CHANNEL, ASSETS);
    expect(fromMessage).toHaveLength(2);
    expect(fromMessage[0]).toContain("/123/");
    expect(burstEmoteUrls({ emotes: [] }, { message: "Cheer100 wizHype" }, CHANNEL, ASSETS)).toEqual(["own/4"]);
    expect(burstEmoteUrls({ emotes: [] }, {}, CHANNEL, ASSETS)).toEqual(["own/4"]);
    expect(burstEmoteUrls({ emotes: [] }, {}, {}, ASSETS)).toEqual([FALLBACK_EMOTE_URL]);
    expect(burstEmoteUrls({ emotes: [] }, {}, CHANNEL, ASSETS, ["wizHype"])).toEqual([FALLBACK_EMOTE_URL]);
  });
});
