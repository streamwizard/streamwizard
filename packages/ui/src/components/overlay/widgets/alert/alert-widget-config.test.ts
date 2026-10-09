import { describe, expect, it } from "bun:test";
import {
  ALERT_AMOUNT_LABELS,
  ALERT_DEFAULT_ON_EVENTS,
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_TYPES,
  ALERT_LOOK_KEYS,
  ALERT_NAME_LABELS,
  ALERT_MAX_HOLD_MS,
  ALERT_MEDIA_END_GRACE_MS,
  ALERT_MIN_HOLD_MS,
  DEFAULT_ALERT_VARIANT_TITLES,
  alertInstanceFromSocketMessage,
  alertLiveLook,
  alertMediaOutAtMs,
  alertSkipReason,
  alertTimeline,
  alertTokensForEvent,
  migrateAlertAnimationIn,
  migrateAlertAnimationOut,
  alertPresentationOf,
  alertVariationParameters,
  alertVariationOperators,
  alertVariationSummary,
  createAlertVariation,
  pickAlertVariation,
  ALERT_PRESENTATION_KEYS,
  ALERT_VARIATION_EVENTS,
  type AlertInstance,
  type AlertVariation,
  type AlertVariationCondition,
  applyAlertLookToAll,
  buildTestAlertSocketMessage,
  clampAlertOutAtMs,
  createDefaultAlertVariantConfig,
  createDefaultAlertWidgetConfig,
  normalizeAlertWidgetConfig,
  renderAlertTemplate,
  type AlertEventType,
} from "./alert-widget-config";
import { buildWidgetTestEvent } from "@repo/schemas";
import {
  ALERT_ENTER_ANIMATIONS,
  ALERT_EXIT_ANIMATIONS,
  ALERT_HIGHLIGHT_ANIMATIONS,
  alertEffectKeyframes,
  alertEffectStyle,
} from "./alert-animations";
import { alertWidgetItemConfigSchema } from "../../../../overlay-schemas";

/** A `channel.chat.notification` payload with one notice block populated. */
function notice(
  noticeType: string,
  blocks: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return {
    type: "channel.chat.notification",
    payload: {
      chatter_user_name: "toastcrumb",
      chatter_is_anonymous: false,
      notice_type: noticeType,
      message: { text: "hello", fragments: [] },
      ...blocks,
      ...extra,
    },
  };
}

describe("alert event tables", () => {
  // Adding an event means touching five tables. Miss one and the editor renders
  // `undefined` at a streamer rather than failing anywhere a developer looks.
  for (const event of ALERT_EVENT_TYPES) {
    it(`${event} is described in every table`, () => {
      expect(ALERT_EVENT_LABELS[event]).toBeTruthy();
      expect(ALERT_NAME_LABELS[event]).toBeTruthy();
      expect(DEFAULT_ALERT_VARIANT_TITLES[event]).toBeTruthy();
      expect(ALERT_EVENT_SUBSCRIPTION_TYPES[event]?.type).toBeTruthy();
      expect(event in ALERT_AMOUNT_LABELS).toBe(true);
    });
  }

  it("has no event in two categories", () => {
    const flat = ALERT_EVENT_CATEGORIES.flatMap((c) => c.events);
    expect(new Set(flat).size).toBe(flat.length);
  });

  it("only uses {amount} in a default title when the event carries one", () => {
    for (const event of ALERT_EVENT_TYPES) {
      if (DEFAULT_ALERT_VARIANT_TITLES[event].includes("{amount}")) {
        expect(ALERT_AMOUNT_LABELS[event]).toBeTruthy();
      }
    }
  });
});

describe("test alerts round-trip", () => {
  /*
   * The strongest guard on the whole feature: every Test button in the editor
   * must produce an event the widget maps back to the alert the streamer
   * pressed. A wrong variant name or a fixture whose notice_type drifted shows
   * up here instead of as a dead Test button.
   */
  for (const event of ALERT_EVENT_TYPES) {
    it(`${event} test fixture maps back to ${event}`, () => {
      const msg = buildTestAlertSocketMessage(event);
      const alert = alertInstanceFromSocketMessage(msg);
      expect(alert?.event).toBe(event);
    });
  }
});

describe("dedupe: the chat notice is the single source", () => {
  // These five arrive twice -- once on their own subscription, once as a chat
  // notice. The dedicated one is dropped so one celebration is one alert.
  const DOUBLED = [
    "channel.subscribe",
    "channel.subscription.message",
    "channel.subscription.gift",
    "channel.raid",
  ];

  for (const type of DOUBLED) {
    it(`${type} does not fire an alert`, () => {
      expect(alertInstanceFromSocketMessage({ type, payload: {} })).toBeNull();
    });
  }

  it("skips the per-recipient notices inside a gift bomb", () => {
    // A 100-sub bomb sends one community_sub_gift plus 100 sub_gift notices.
    const inBomb = alertInstanceFromSocketMessage(
      notice("sub_gift", {
        sub_gift: { cumulative_total: 12, community_gift_id: "bomb-1" },
      })
    );
    expect(inBomb).toBeNull();

    const lone = alertInstanceFromSocketMessage(
      notice("sub_gift", { sub_gift: { cumulative_total: 12, community_gift_id: null } })
    );
    expect(lone?.event).toBe("gift_sub");
  });

  it("ignores notices relayed from another channel's shared chat", () => {
    expect(alertInstanceFromSocketMessage(notice("shared_chat_sub"))).toBeNull();
    expect(
      alertInstanceFromSocketMessage(notice("sub", {}, { is_source_only: true }))
    ).toBeNull();
  });

  it("ignores unraid and notice types it has never heard of", () => {
    expect(alertInstanceFromSocketMessage(notice("unraid"))).toBeNull();
    expect(alertInstanceFromSocketMessage(notice("unknown"))).toBeNull();
    expect(alertInstanceFromSocketMessage(notice("something_new_2027"))).toBeNull();
  });

  it("holds when the demo bar sends a raw message instead of an alert type", () => {
    // The demo bar fires whatever the picker holds down the same local path as
    // the inspector's Test button. Its "Sub" button is wired to the chat notice
    // for exactly this reason -- the dedicated subscription still drops.
    const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES.sub;
    expect(
      alertInstanceFromSocketMessage(buildWidgetTestEvent(type, undefined, variant))?.event
    ).toBe("sub");
    expect(
      alertInstanceFromSocketMessage(buildWidgetTestEvent("channel.subscribe"))
    ).toBeNull();
  });

  it("still fires follow and cheer from their own subscriptions", () => {
    expect(
      alertInstanceFromSocketMessage({
        type: "channel.follow",
        payload: { user_name: "pixelgremlin" },
      })?.event
    ).toBe("follow");
    expect(
      alertInstanceFromSocketMessage({
        type: "channel.cheer",
        payload: { user_name: "sandwichlord", bits: 500, message: "hi" },
      })?.amount
    ).toBe(500);
  });
});

describe("one celebration, one alert", () => {
  /*
   * The end-to-end check on the dedupe rules. Every message below really does
   * arrive at the widget -- the bot forwards every conduit event to the room
   * with no server-side filtering -- so counting the alerts a whole sequence
   * produces is the only honest test of "does a gift bomb fire once".
   */
  const fired = (msgs: { type: string; payload: unknown }[]) =>
    msgs.map(alertInstanceFromSocketMessage).filter((a) => a !== null);

  it("fires once for a 5-sub gift bomb, not twelve times", () => {
    const bombId = "bomb-1";
    const alerts = fired([
      // The dedicated subscription, carrying the whole bomb.
      { type: "channel.subscription.gift", payload: { user_name: "sandwichlord", total: 5 } },
      // The bomb's own notice.
      notice("community_sub_gift", { community_sub_gift: { id: bombId, total: 5 } }),
      // One notice per recipient, each tagged with the bomb id.
      ...Array.from({ length: 5 }, (_, i) =>
        notice("sub_gift", {
          sub_gift: { community_gift_id: bombId, recipient_user_name: `viewer${i}` },
        })
      ),
      // And a dedicated subscribe per recipient.
      ...Array.from({ length: 5 }, () => ({
        type: "channel.subscribe",
        payload: { user_name: "viewer", is_gift: true },
      })),
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.event).toBe("community_gift");
    expect(alerts[0]!.amount).toBe(5);
  });

  it("fires once for a single gift sub", () => {
    const alerts = fired([
      { type: "channel.subscription.gift", payload: { user_name: "toastcrumb", total: 1 } },
      notice("sub_gift", {
        sub_gift: { community_gift_id: null, recipient_user_name: "ninetoad", cumulative_total: 12 },
      }),
      { type: "channel.subscribe", payload: { user_name: "ninetoad", is_gift: true } },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.event).toBe("gift_sub");
  });

  it("fires once for a plain sub, a resub and a raid", () => {
    expect(
      fired([
        { type: "channel.subscribe", payload: { user_name: "pixelgremlin", is_gift: false } },
        notice("sub", { sub: { sub_plan: "1000", is_gift: false } }),
      ])
    ).toHaveLength(1);

    expect(
      fired([
        {
          type: "channel.subscription.message",
          payload: { user_name: "sandwichlord", cumulative_months: 6 },
        },
        notice("resub", { resub: { cumulative_months: 6 } }),
      ])
    ).toHaveLength(1);

    expect(
      fired([
        { type: "channel.raid", payload: { from_broadcaster_user_name: "ModMothra", viewers: 42 } },
        notice("raid", { raid: { user_name: "ModMothra", viewer_count: 42 } }),
      ])
    ).toHaveLength(1);
  });

  it("stays silent through a shared chat session's relayed subs", () => {
    expect(
      fired([
        notice("shared_chat_sub", {}),
        notice("shared_chat_community_sub_gift", {}),
        notice("sub", { sub: { sub_plan: "1000" } }, { is_source_only: true }),
      ])
    ).toHaveLength(0);
  });
});

describe("notice payloads", () => {
  it("reads the resub month count and what the viewer typed", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("resub", { resub: { cumulative_months: 6 } })
    );
    expect(alert?.event).toBe("resub");
    expect(alert?.amount).toBe(6);
    expect(alert?.message).toBe("hello");
  });

  it("reads a gift bomb's size", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("community_sub_gift", { community_sub_gift: { total: 5 } })
    );
    expect(alert?.event).toBe("community_gift");
    expect(alert?.amount).toBe(5);
  });

  it("counts a watch streak in streams", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("watch_streak", { watch_streak: { consecutive_months: 25 } })
    );
    expect(alert?.amount).toBe(25);
  });

  it("takes the raider and viewer count off the notice's raid block", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("raid", { raid: { user_name: "ModMothra", viewer_count: 42 } })
    );
    expect(alert?.name).toBe("ModMothra");
    expect(alert?.amount).toBe(42);
  });

  it("formats a charity donation as money, and still compares as a number", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("charity_donation", {
        charity_donation: {
          charity_name: "Cats With Hats",
          amount: { value: 2500, decimal_places: 2, currency: "USD" },
        },
      })
    );
    // The threshold check runs on `amount`, so it has to be the real number.
    expect(alert?.amount).toBe(25);
    expect(alert?.amountText).toContain("25");
    expect(alert?.detail).toBe("Cats With Hats");
    expect(renderAlertTemplate("{name} gave {amount} to {charity}!", alert!)).toBe(
      `toastcrumb gave ${alert!.amountText} to Cats With Hats!`
    );
  });

  it("names the original gifter, and says so when they were anonymous", () => {
    const named = alertInstanceFromSocketMessage(
      notice("pay_it_forward", {
        pay_it_forward: { gifter_is_anonymous: false, gifter_user_name: "sandwichlord" },
      })
    );
    expect(named?.gifter).toBe("sandwichlord");

    const anon = alertInstanceFromSocketMessage(
      notice("pay_it_forward", {
        pay_it_forward: { gifter_is_anonymous: true, gifter_user_name: null },
      })
    );
    expect(anon?.gifter).toBe("an anonymous gifter");
    expect(renderAlertTemplate("paying {gifter}'s sub forward", anon!)).toBe(
      "paying an anonymous gifter's sub forward"
    );
  });
});

describe("dedicated subscriptions the alert box still owns", () => {
  it("reads a redemption's reward and cost", () => {
    const alert = alertInstanceFromSocketMessage({
      type: "channel.channel_points_custom_reward_redemption.add",
      payload: {
        user_name: "ninetoad",
        user_input: "glug glug",
        reward: { title: "Hydrate", cost: 500 },
      },
    });
    expect(alert?.event).toBe("redemption");
    expect(alert?.amount).toBe(500);
    expect(alert?.detail).toBe("Hydrate");
    expect(renderAlertTemplate("{name} redeemed {reward}!", alert!)).toBe(
      "ninetoad redeemed Hydrate!"
    );
  });

  it("reads the ad break duration, typed or stringly", () => {
    // Real payloads carry an integer (verified against logged ad breaks and
    // the Twitch CLI), but the schema claimed string for years -- so accept
    // both rather than render "Ads for 0 seconds" if it ever comes back.
    for (const duration of [60, "60"]) {
      const alert = alertInstanceFromSocketMessage({
        type: "channel.ad_break.begin",
        payload: { broadcaster_user_name: "Broadcaster", duration_seconds: duration },
      });
      expect(alert?.amount).toBe(60);
    }
  });

  it("credits the top contributor on a hype train, or the crowd", () => {
    const withTop = alertInstanceFromSocketMessage({
      type: "channel.hype_train.end",
      payload: { level: 4, top_contributions: [{ user_name: "toastcrumb" }] },
    });
    expect(withTop?.name).toBe("toastcrumb");
    expect(withTop?.amount).toBe(4);

    const empty = alertInstanceFromSocketMessage({
      type: "channel.hype_train.begin",
      payload: { level: 1, top_contributions: [] },
    });
    expect(empty?.name).toBe("Chat");
  });

  it("announces the winning poll choice, and stays quiet on a cancelled poll", () => {
    const choices = [
      { title: "Hard socks", votes: 140 },
      { title: "Absolutely not", votes: 62 },
    ];
    const won = alertInstanceFromSocketMessage({
      type: "channel.poll.end",
      payload: { status: "completed", choices },
    });
    expect(won?.name).toBe("Hard socks");
    expect(won?.amount).toBe(140);

    expect(
      alertInstanceFromSocketMessage({
        type: "channel.poll.end",
        payload: { status: "terminated", choices },
      })
    ).toBeNull();
  });
});

describe("defaults", () => {
  it("ships only the alerts every other provider ships as standard", () => {
    const cfg = createDefaultAlertWidgetConfig();
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event].enabled).toBe(ALERT_DEFAULT_ON_EVENTS.includes(event));
    }
  });

  it("holds every alert for its own set time until asked otherwise", () => {
    const cfg = createDefaultAlertWidgetConfig();
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event].durationMode).toBe("fixed");
    }
  });

  it("keeps the six the widget already fired switched on", () => {
    for (const event of ["follow", "sub", "resub", "gift_sub", "cheer", "raid"] as const) {
      expect(ALERT_DEFAULT_ON_EVENTS).toContain(event);
    }
    // Gift bombs fired before too, as part of the old gift_sub alert.
    expect(ALERT_DEFAULT_ON_EVENTS).toContain("community_gift");
  });
});

describe("the gate a test alert still has to clear", () => {
  const cheer = alertInstanceFromSocketMessage({
    type: "channel.cheer",
    payload: { user_name: "sandwichlord", bits: 100, message: "hi" },
  })!;

  it("lets a live variant through", () => {
    expect(alertSkipReason(cheer, createDefaultAlertVariantConfig("cheer"))).toBeNull();
  });

  it("names a switched-off variant so the editor can say why nothing played", () => {
    const off = { ...createDefaultAlertVariantConfig("cheer"), enabled: false };
    expect(alertSkipReason(cheer, off)).toBe("disabled");
  });

  it("names a minimum the test didn't reach", () => {
    const gated = { ...createDefaultAlertVariantConfig("cheer"), minAmount: 500 };
    expect(alertSkipReason(cheer, gated)).toBe("below-minimum");

    // The boundary is inclusive: a 100-bit cheer clears a 100-bit minimum.
    expect(
      alertSkipReason(cheer, { ...createDefaultAlertVariantConfig("cheer"), minAmount: 100 })
    ).toBeNull();
  });

  it("reports the switch before the minimum -- fixing the switch comes first", () => {
    const both = {
      ...createDefaultAlertVariantConfig("cheer"),
      enabled: false,
      minAmount: 500,
    };
    expect(alertSkipReason(cheer, both)).toBe("disabled");
  });
});

describe("config migration", () => {
  it("defaults every new event on a config saved before they existed", () => {
    const cfg = normalizeAlertWidgetConfig({
      gapSeconds: 2,
      masterVolume: 0.5,
      variants: { follow: { enabled: false } },
    });
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event]).toBeDefined();
    }
    expect(cfg.variants.follow.enabled).toBe(false);
    expect(cfg.gapSeconds).toBe(2);
  });

  it("does not switch on a single new alert when an old config is loaded", () => {
    // The upgrade guarantee: a streamer who saved this config before any of
    // these events existed must not find ad breaks and polls on their overlay.
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: { enabled: true },
        sub: { enabled: true },
        resub: { enabled: true },
        gift_sub: { enabled: true },
        cheer: { enabled: true },
        raid: { enabled: true },
      },
    });
    for (const event of ALERT_EVENT_TYPES) {
      if (event === "community_gift") continue; // inherits the old gift_sub
      const wasConfigured = ["follow", "sub", "resub", "gift_sub", "cheer", "raid"].includes(
        event
      );
      expect(cfg.variants[event].enabled).toBe(wasConfigured);
    }
  });

  it("carries a disabled gift_sub's off state onto gift bombs", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { gift_sub: { enabled: false } },
    });
    expect(cfg.variants.community_gift.enabled).toBe(false);
  });

  it("hands a saved gift_sub's bomb setup to the new gift bomb alert", () => {
    // gift_sub used to BE the gift bomb, so the media and wording a streamer
    // picked belong to community_gift now.
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        gift_sub: {
          enabled: true,
          mediaUrl: "https://cdn.example/gift-bomb.webm",
          mediaKind: "video",
          titleTemplate: "{name} gifted {amount} subs!",
        },
      },
    });
    expect(cfg.variants.community_gift.mediaUrl).toBe("https://cdn.example/gift-bomb.webm");
    expect(cfg.variants.community_gift.titleTemplate).toBe("{name} gifted {amount} subs!");
    // ...and the single-gift alert goes back to wording that is true of it.
    expect(cfg.variants.gift_sub.titleTemplate).toBe(DEFAULT_ALERT_VARIANT_TITLES.gift_sub);
  });

  it("leaves a hand-written gift_sub title alone", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { gift_sub: { titleTemplate: "{name} is generous!" } },
    });
    expect(cfg.variants.gift_sub.titleTemplate).toBe("{name} is generous!");
  });

  it("leaves alerts saved before video matching existed on a set time", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: { mediaUrl: "https://cdn.example/pop.webm", mediaKind: "video" },
      },
    });
    expect(cfg.variants.follow.durationMode).toBe("fixed");
  });

  it("keeps a saved video-matched alert matched", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: {
          mediaUrl: "https://cdn.example/pop.webm",
          mediaKind: "video",
          durationMode: "media",
        },
      },
    });
    expect(cfg.variants.follow.durationMode).toBe("media");
  });

  it("falls back to a set time when the saved mode is junk", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { follow: { durationMode: "as-long-as-it-takes" } },
    });
    expect(cfg.variants.follow.durationMode).toBe("fixed");
  });

  it("keeps a config that already has both alerts", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        gift_sub: { titleTemplate: "{name} gifted {amount} subs!" },
        community_gift: { titleTemplate: "bomb!" },
      },
    });
    expect(cfg.variants.community_gift.titleTemplate).toBe("bomb!");
    expect(cfg.variants.gift_sub.titleTemplate).toBe("{name} gifted {amount} subs!");
  });
});

describe("alert type coverage", () => {
  it("configures 23 alerts", () => {
    // 29 in the public catalog minus the six that need an OAuth scope
    // StreamWizard does not request yet (ban, VIP, mod, 2x prediction, goal).
    expect(ALERT_EVENT_TYPES.length).toBe(23);
  });

  it("still ships the six the widget started with", () => {
    const original: AlertEventType[] = ["follow", "sub", "resub", "gift_sub", "cheer", "raid"];
    for (const event of original) {
      expect(ALERT_EVENT_TYPES).toContain(event);
    }
  });
});

describe("the queue limit", () => {
  it("lets 50 alerts wait unless told otherwise", () => {
    expect(createDefaultAlertWidgetConfig().maxQueue).toBe(50);
    // A box saved before the limit existed gets the default, not zero.
    expect(normalizeAlertWidgetConfig({ gapSeconds: 2, variants: {} }).maxQueue).toBe(50);
  });

  it("keeps a saved limit and pulls a junk one back in range", () => {
    expect(normalizeAlertWidgetConfig({ maxQueue: 20 }).maxQueue).toBe(20);
    expect(normalizeAlertWidgetConfig({ maxQueue: 0 }).maxQueue).toBe(1);
    expect(normalizeAlertWidgetConfig({ maxQueue: 99_999 }).maxQueue).toBe(200);
    expect(normalizeAlertWidgetConfig({ maxQueue: "lots" }).maxQueue).toBe(50);
  });

  it("is not stripped by the save schema", () => {
    const saved = alertWidgetItemConfigSchema.parse({
      ...createDefaultAlertWidgetConfig(),
      maxQueue: 20,
    });
    expect(saved.maxQueue).toBe(20);
  });
});

describe("resub wording", () => {
  const OLD_DEFAULT = "{name} subscribed for {amount} months in a row!";

  it("does not promise a streak while printing the total", () => {
    expect(DEFAULT_ALERT_VARIANT_TITLES.resub).not.toContain("in a row");
  });

  it("moves a saved box off the old default", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { resub: { titleTemplate: OLD_DEFAULT } },
    });
    expect(cfg.variants.resub.titleTemplate).toBe(DEFAULT_ALERT_VARIANT_TITLES.resub);
  });

  it("leaves a hand-written resub title alone", () => {
    const mine = "{name} is back for month {amount}";
    const cfg = normalizeAlertWidgetConfig({
      variants: { resub: { titleTemplate: mine } },
    });
    expect(cfg.variants.resub.titleTemplate).toBe(mine);
  });

  it("only rewrites that wording on resub", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { sub: { titleTemplate: OLD_DEFAULT } },
    });
    expect(cfg.variants.sub.titleTemplate).toBe(OLD_DEFAULT);
  });
});

describe("templates", () => {
  it("shows a token the viewer typed as typed", () => {
    const alert = alertInstanceFromSocketMessage({
      type: "channel.channel_points_custom_reward_redemption.add",
      payload: {
        user_name: "toastcrumb",
        user_input: "{reward} {charity} {gifter} {amount} {name}",
        reward: { title: "Hydrate", cost: 500 },
      },
    })!;
    expect(renderAlertTemplate("{name} redeemed {reward}: {message}", alert)).toBe(
      "toastcrumb redeemed Hydrate: {reward} {charity} {gifter} {amount} {name}"
    );
  });

  it("names who got a gift sub", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("sub_gift", {
        sub_gift: { cumulative_total: 3, recipient_user_name: "ninetoad" },
      })
    )!;
    expect(renderAlertTemplate("{name} gifted a sub to {recipient}!", alert)).toBe(
      "toastcrumb gifted a sub to ninetoad!"
    );
  });

  it("leaves a token it does not know in place", () => {
    const alert = alertInstanceFromSocketMessage({
      type: "channel.follow",
      payload: { user_name: "toastcrumb" },
    })!;
    expect(renderAlertTemplate("{name} {nope}", alert)).toBe("toastcrumb {nope}");
  });
});

describe("video-matched timing", () => {
  const IN_MS = 500;

  it("measures the video's end from where playback stands, not the alert's start", () => {
    // A 4 s video whose metadata landed 1.2 s in still gets its full 4 s.
    expect(alertMediaOutAtMs(1200, 4, 0)).toBe(1200 + 4000 + ALERT_MEDIA_END_GRACE_MS);
    // Already half a second into playback: only the rest is left.
    expect(alertMediaOutAtMs(1200, 4, 0.5)).toBe(1200 + 3500 + ALERT_MEDIA_END_GRACE_MS);
  });

  it("has no answer for a video that does not know its length", () => {
    expect(alertMediaOutAtMs(1200, Infinity, 0)).toBeNull();
    expect(alertMediaOutAtMs(1200, NaN, 0)).toBeNull();
    expect(alertMediaOutAtMs(1200, 0, 0)).toBeNull();
  });

  it("holds a blink-length video for the minimum and cuts a long one at the ceiling", () => {
    expect(clampAlertOutAtMs(300, IN_MS)).toBe(IN_MS + ALERT_MIN_HOLD_MS);
    expect(clampAlertOutAtMs(3_600_000, IN_MS)).toBe(IN_MS + ALERT_MAX_HOLD_MS);
    expect(clampAlertOutAtMs(5000, IN_MS)).toBe(5000);
  });
});

describe("one look for every alert", () => {
  const base = createDefaultAlertWidgetConfig();
  const cfg = {
    ...base,
    variants: {
      ...base.variants,
      follow: {
        ...base.variants.follow,
        fontSize: 48,
        accentColor: "#ff0066",
        animationIn: "bounce_in" as const,
        layout: "row" as const,
        textShadow: false,
      },
      cheer: {
        ...base.variants.cheer,
        enabled: false,
        mediaUrl: "https://cdn.example/cheer.webm",
        mediaKind: "video" as const,
        soundUrl: "https://cdn.example/cheer.mp3",
        minAmount: 100,
        durationSeconds: 12,
        titleTemplate: "{name} dropped {amount}",
      },
    },
  };
  const copied = applyAlertLookToAll(cfg, "follow");

  it("gives every alert the source alert's look", () => {
    for (const event of ALERT_EVENT_TYPES) {
      for (const key of ALERT_LOOK_KEYS) {
        expect(copied.variants[event][key]).toBe(cfg.variants.follow[key]);
      }
    }
  });

  it("leaves what each alert says, plays and when it fires alone", () => {
    const look = new Set<string>(ALERT_LOOK_KEYS);
    for (const event of ALERT_EVENT_TYPES) {
      for (const [key, value] of Object.entries(cfg.variants[event])) {
        if (look.has(key)) continue;
        expect(copied.variants[event][key as keyof typeof cfg.variants.follow]).toBe(value);
      }
    }
    expect(copied.variants.cheer.mediaUrl).toBe("https://cdn.example/cheer.webm");
    expect(copied.variants.cheer.enabled).toBe(false);
    expect(copied.gapSeconds).toBe(cfg.gapSeconds);
  });

  it("does not write into the config it was handed", () => {
    expect(cfg.variants.cheer.fontSize).toBe(base.variants.cheer.fontSize);
  });
});

describe("the tokens an alert can fill", () => {
  it("always offers the name", () => {
    for (const event of ALERT_EVENT_TYPES) {
      expect(alertTokensForEvent(event).has("name")).toBe(true);
    }
  });

  it("offers only what the event carries", () => {
    expect([...alertTokensForEvent("follow")]).toEqual(["name"]);
    expect([...alertTokensForEvent("cheer")].sort()).toEqual(["amount", "message", "name"]);
    expect(alertTokensForEvent("gift_sub").has("recipient")).toBe(true);
    expect(alertTokensForEvent("charity_donation").has("charity")).toBe(true);
    expect(alertTokensForEvent("charity_donation").has("reward")).toBe(false);
    expect(alertTokensForEvent("pay_it_forward").has("gifter")).toBe(true);
  });

  it("offers every token a default title uses", () => {
    for (const event of ALERT_EVENT_TYPES) {
      const offered = alertTokensForEvent(event);
      for (const [, token] of DEFAULT_ALERT_VARIANT_TITLES[event].matchAll(/\{(\w+)\}/g)) {
        expect(offered.has(token as never)).toBe(true);
      }
    }
  });
});

// ─── Variations ─────────────────────────────────────────────────────────────

/** A cheer of `bits` from `name`, as the renderer would see it. */
function cheer(bits: number, name = "toastcrumb"): AlertInstance {
  return alertInstanceFromSocketMessage({
    type: "channel.cheer",
    payload: { user_name: name, user_login: name.toLowerCase(), bits, message: "" },
  })!;
}

function variation(
  id: string,
  condition: AlertVariationCondition,
  extra: Partial<AlertVariation> = {}
): AlertVariation {
  return {
    ...createAlertVariation("cheer", createDefaultAlertVariantConfig("cheer"), id, id),
    condition,
    ...extra,
  };
}

/** A cheer alert carrying `variations`. */
function cheerAlert(variations: AlertVariation[], randomPick = false) {
  return { ...createDefaultAlertVariantConfig("cheer"), variations, randomPick };
}

/** Rolls that always pass a chance above 0. */
const always = { random: () => 0, sessionTop: 0 };
const atLeast = (value: number): AlertVariationCondition => ({
  parameter: "amount",
  operator: "at_least",
  value,
});

describe("which alerts take variations", () => {
  it("is the seventeen that have something to match on", () => {
    expect([...ALERT_VARIATION_EVENTS].sort() as string[]).toEqual(
      [
        "ad_break",
        "bits_badge",
        "charity_donation",
        "cheer",
        "community_gift",
        "gift_sub",
        "hype_train_end",
        "hype_train_start",
        "modiversary",
        "poll_winner",
        "raid",
        "redemption",
        "resub",
        "shoutout_received",
        "shoutout_sent",
        "sub",
        "watch_streak",
      ].sort()
    );
  });

  it("offers nothing on the rest", () => {
    for (const event of ["follow", "gift_upgrade", "prime_upgrade", "pay_it_forward", "announcement", "poll_start"] as const) {
      expect(alertVariationParameters(event)).toEqual([]);
    }
  });

  it("offers each alert only what its events carry", () => {
    expect(alertVariationParameters("cheer")).toEqual(["none", "amount", "name"]);
    expect(alertVariationParameters("sub")).toEqual(["none", "tier", "name"]);
    expect(alertVariationParameters("resub")).toEqual(["none", "amount", "tier", "name"]);
    // No year in the payload: a modiversary can only be told apart by who it is.
    expect(alertVariationParameters("modiversary")).toEqual(["none", "name"]);
    // Nobody to name on an ad break or a poll.
    expect(alertVariationParameters("ad_break")).toEqual(["none", "amount"]);
    expect(alertVariationParameters("poll_winner")).toEqual(["none", "amount"]);
  });

  it("keeps the biggest-of-the-stream condition to the events people celebrate it on", () => {
    expect(alertVariationOperators("cheer")).toContain("session_top");
    expect(alertVariationOperators("raid")).toContain("session_top");
    expect(alertVariationOperators("watch_streak")).not.toContain("session_top");
    expect(alertVariationOperators("ad_break")).not.toContain("session_top");
  });
});

describe("which variation plays", () => {
  it("plays the alert itself when there are none, or none match", () => {
    expect(pickAlertVariation(cheer(50), cheerAlert([]), always)).toBeNull();
    expect(pickAlertVariation(cheer(50), cheerAlert([variation("big", atLeast(100))]), always)).toBeNull();
  });

  it("matches exactly, and at least", () => {
    const exact = variation("exact", { parameter: "amount", operator: "exact", value: 100 });
    expect(pickAlertVariation(cheer(100), cheerAlert([exact]), always)?.id).toBe("exact");
    expect(pickAlertVariation(cheer(101), cheerAlert([exact]), always)).toBeNull();

    const more = variation("more", atLeast(100));
    expect(pickAlertVariation(cheer(100), cheerAlert([more]), always)?.id).toBe("more");
    expect(pickAlertVariation(cheer(5000), cheerAlert([more]), always)?.id).toBe("more");
    expect(pickAlertVariation(cheer(99), cheerAlert([more]), always)).toBeNull();
  });

  it("plays the highest requirement a cheer reaches, whatever the list order", () => {
    const tiers = [atLeast(1000), atLeast(1), atLeast(10000), atLeast(100)].map((c) =>
      variation(`at-${c.parameter === "amount" ? c.value : 0}`, c)
    );
    expect(pickAlertVariation(cheer(1000), cheerAlert(tiers), always)?.id).toBe("at-1000");
    expect(pickAlertVariation(cheer(9999), cheerAlert(tiers), always)?.id).toBe("at-1000");
    expect(pickAlertVariation(cheer(50), cheerAlert(tiers), always)?.id).toBe("at-1");
    expect(pickAlertVariation(cheer(25000), cheerAlert(tiers), always)?.id).toBe("at-10000");
  });

  it("lets the more specific kind of condition win over a higher number", () => {
    const list = [
      variation("least", atLeast(500)),
      variation("exact", { parameter: "amount", operator: "exact", value: 100 }),
      variation("top", { parameter: "amount", operator: "session_top", value: 0 }),
      variation("named", { parameter: "name", names: ["toastcrumb"] }),
      variation("any", { parameter: "none" }),
    ];
    const pick = (ids: string[], bits: number) =>
      pickAlertVariation(cheer(bits), cheerAlert(list.filter((v) => ids.includes(v.id))), always)?.id;

    expect(pick(["least", "exact", "top", "named", "any"], 100)).toBe("named");
    expect(pick(["least", "exact", "top", "any"], 100)).toBe("top");
    // 600 bits is no longer the exact 100, and still a record.
    expect(pick(["least", "exact", "any"], 100)).toBe("exact");
    expect(pick(["least", "any"], 600)).toBe("least");
    expect(pick(["any"], 1)).toBe("any");
  });

  it("only calls it the biggest of the stream when it beats what came before", () => {
    const top = cheerAlert([variation("top", { parameter: "amount", operator: "session_top", value: 0 })]);
    // The first cheer of a stream is the biggest so far.
    expect(pickAlertVariation(cheer(100), top, { random: () => 0, sessionTop: 0 })?.id).toBe("top");
    expect(pickAlertVariation(cheer(500), top, { random: () => 0, sessionTop: 100 })?.id).toBe("top");
    // Matching the record is not beating it.
    expect(pickAlertVariation(cheer(500), top, { random: () => 0, sessionTop: 500 })).toBeNull();
    expect(pickAlertVariation(cheer(499), top, { random: () => 0, sessionTop: 500 })).toBeNull();
  });

  it("holds a record variation to its own minimum as well", () => {
    const top = cheerAlert([variation("top", { parameter: "amount", operator: "session_top", value: 1000 })]);
    expect(pickAlertVariation(cheer(500), top, { random: () => 0, sessionTop: 100 })).toBeNull();
    expect(pickAlertVariation(cheer(1000), top, { random: () => 0, sessionTop: 100 })?.id).toBe("top");
  });

  it("matches a viewer by display name or login, whatever the casing", () => {
    const named = cheerAlert([variation("vip", { parameter: "name", names: ["toastcrumb", "ninetoad"] })]);
    expect(pickAlertVariation(cheer(1, "ToastCrumb"), named, always)?.id).toBe("vip");
    expect(pickAlertVariation(cheer(1, "NINETOAD"), named, always)?.id).toBe("vip");
    expect(pickAlertVariation(cheer(1, "sandwichlord"), named, always)).toBeNull();

    // A localized display name still matches on the login behind it.
    const localized = alertInstanceFromSocketMessage({
      type: "channel.cheer",
      payload: { user_name: "トースト", user_login: "toastcrumb", bits: 1, message: "" },
    })!;
    expect(pickAlertVariation(localized, named, always)?.id).toBe("vip");
  });

  it("matches a sub on its tier, Prime included", () => {
    const sub = (block: Record<string, unknown>) =>
      alertInstanceFromSocketMessage(notice("sub", { sub: block }))!;
    const tiered = {
      ...createDefaultAlertVariantConfig("sub"),
      variations: [
        { ...variation("t3", { parameter: "tier", tier: "3000" }) },
        { ...variation("prime", { parameter: "tier", tier: "prime" }) },
      ],
    };
    // Twitch's documented field, and the one our fixtures use.
    expect(pickAlertVariation(sub({ sub_tier: "3000", is_prime: false }), tiered, always)?.id).toBe("t3");
    expect(pickAlertVariation(sub({ sub_plan: "3000" }), tiered, always)?.id).toBe("t3");
    expect(pickAlertVariation(sub({ sub_tier: "1000", is_prime: true }), tiered, always)?.id).toBe("prime");
    expect(pickAlertVariation(sub({ sub_tier: "1000", is_prime: false }), tiered, always)).toBeNull();
  });

  it("ignores a variation that is switched off", () => {
    const off = cheerAlert([variation("big", atLeast(100), { enabled: false }), variation("small", atLeast(1))]);
    expect(pickAlertVariation(cheer(500), off, always)?.id).toBe("small");
  });

  it("plays a variation as often as its chance says", () => {
    const quarter = cheerAlert([variation("rare", atLeast(1), { chance: 25 })]);
    expect(pickAlertVariation(cheer(1), quarter, { random: () => 0.2499, sessionTop: 0 })?.id).toBe("rare");
    expect(pickAlertVariation(cheer(1), quarter, { random: () => 0.25, sessionTop: 0 })).toBeNull();

    const never = cheerAlert([variation("never", atLeast(1), { chance: 0 })]);
    expect(pickAlertVariation(cheer(1), never, { random: () => 0, sessionTop: 0 })).toBeNull();

    const every = cheerAlert([variation("every", atLeast(1), { chance: 100 })]);
    expect(pickAlertVariation(cheer(1), every, { random: () => 0.999999, sessionTop: 0 })?.id).toBe("every");
  });

  it("falls back to a lower variation when the higher one misses its chance roll", () => {
    const list = cheerAlert([variation("big", atLeast(1000), { chance: 50 }), variation("small", atLeast(1))]);
    // Rolls come in list order: the first is big's, the second small's.
    const rolls = [0.9, 0];
    expect(pickAlertVariation(cheer(5000), list, { random: () => rolls.shift()!, sessionTop: 0 })?.id).toBe("small");
  });

  it("plays the first of several tied variations, or a random one when asked", () => {
    const tied = [variation("a", atLeast(100)), variation("b", atLeast(100)), variation("c", atLeast(100))];
    expect(pickAlertVariation(cheer(100), cheerAlert(tied), always)?.id).toBe("a");

    // Three chance rolls, then the pick itself.
    const roll = (pick: number) => {
      const rolls = [0, 0, 0, pick];
      return { random: () => rolls.shift()!, sessionTop: 0 };
    };
    expect(pickAlertVariation(cheer(100), cheerAlert(tied, true), roll(0))?.id).toBe("a");
    expect(pickAlertVariation(cheer(100), cheerAlert(tied, true), roll(0.5))?.id).toBe("b");
    expect(pickAlertVariation(cheer(100), cheerAlert(tied, true), roll(0.99))?.id).toBe("c");
  });
});

describe("a variation's settings", () => {
  it("starts as a full copy of what it was made from", () => {
    const base = { ...createDefaultAlertVariantConfig("cheer"), fontSize: 64, mediaUrl: "https://cdn.example/a.webm", mediaKind: "video" as const };
    const made = createAlertVariation("cheer", base, "v1", "Big cheer");
    expect(made.settings).toEqual(alertPresentationOf(base));
    expect(Object.keys(made.settings).sort()).toEqual([...ALERT_PRESENTATION_KEYS].sort());
    // The alert's own switch, minimum and variations are not part of a look.
    expect(made.settings).not.toHaveProperty("enabled");
    expect(made.settings).not.toHaveProperty("minAmount");
    expect(made.settings).not.toHaveProperty("variations");
  });

  it("starts on the condition its event is most likely wanted for", () => {
    const from = (event: AlertEventType) =>
      createAlertVariation(event, createDefaultAlertVariantConfig(event), "v", "v").condition;
    expect(from("cheer")).toEqual({ parameter: "amount", operator: "at_least", value: 1 });
    expect(from("sub")).toEqual({ parameter: "tier", tier: "1000" });
    expect(from("modiversary")).toEqual({ parameter: "name", names: [] });
  });

  it("stays put when the alert it came from changes", () => {
    const cfg = createDefaultAlertWidgetConfig();
    cfg.variants.cheer.variations = [createAlertVariation("cheer", cfg.variants.cheer, "v1", "Big")];
    const changed = normalizeAlertWidgetConfig({
      ...cfg,
      variants: { ...cfg.variants, cheer: { ...cfg.variants.cheer, fontSize: 80 } },
    });
    expect(changed.variants.cheer.fontSize).toBe(80);
    expect(changed.variants.cheer.variations[0]!.settings.fontSize).toBe(32);
  });
});

describe("settings changed while an alert plays", () => {
  it("shows a new text style on the alert already on screen", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const started = alertPresentationOf(cfg.variants.follow);
    cfg.variants.follow = {
      ...cfg.variants.follow,
      fontSize: 72,
      fontWeight: 400,
      titleColor: "#ff0000",
      titleTemplate: "Welcome {name}",
    };
    const look = alertLiveLook(cfg, "follow", null, started);
    expect(look.fontSize).toBe(72);
    expect(look.fontWeight).toBe(400);
    expect(look.titleColor).toBe("#ff0000");
    expect(look.titleTemplate).toBe("Welcome {name}");
  });

  it("keeps the timing, media and sound it started with", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const started = alertPresentationOf(cfg.variants.follow);
    cfg.variants.follow = {
      ...cfg.variants.follow,
      durationSeconds: started.durationSeconds + 5,
      animationInSeconds: started.animationInSeconds + 1,
      textDelaySeconds: started.textDelaySeconds + 1,
      mediaUrl: "https://cdn.example/new.webm",
      mediaKind: "video",
      soundUrl: "https://cdn.example/new.mp3",
      volume: 0.1,
    };
    const look = alertLiveLook(cfg, "follow", null, started);
    expect(look).toEqual(started);
    expect(alertTimeline(look, 3000)).toEqual(alertTimeline(started, 3000));
  });

  it("reads a variation's own settings, not its alert's", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const made = createAlertVariation("cheer", cfg.variants.cheer, "v1", "Big");
    const started = made.settings;
    cfg.variants.cheer = {
      ...cfg.variants.cheer,
      fontSize: 80,
      variations: [{ ...made, settings: { ...made.settings, fontSize: 48 } }],
    };
    expect(alertLiveLook(cfg, "cheer", "v1", started).fontSize).toBe(48);
    expect(alertLiveLook(cfg, "cheer", null, started).fontSize).toBe(80);
  });

  it("leaves an alert as it started when its variation is deleted", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const started = { ...alertPresentationOf(cfg.variants.cheer), fontSize: 48 };
    expect(alertLiveLook(cfg, "cheer", "gone", started)).toEqual(started);
  });
});

describe("saved variations", () => {
  it("gives a config saved before variations existed none", () => {
    const cfg = normalizeAlertWidgetConfig({ variants: { cheer: { enabled: true } } });
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event].variations).toEqual([]);
      expect(cfg.variants[event].randomPick).toBe(false);
    }
  });

  it("round-trips through normalize and the save schema unchanged", () => {
    const cfg = createDefaultAlertWidgetConfig();
    cfg.variants.cheer.randomPick = true;
    cfg.variants.cheer.variations = [
      { ...createAlertVariation("cheer", cfg.variants.cheer, "v1", "Big cheer"), chance: 12.5, condition: atLeast(1000) },
      { ...createAlertVariation("cheer", cfg.variants.cheer, "v2", "Regulars"), condition: { parameter: "name", names: ["toastcrumb"] } },
    ];
    cfg.variants.sub.variations = [
      { ...createAlertVariation("sub", cfg.variants.sub, "v1", "Tier 3"), condition: { parameter: "tier", tier: "3000" } },
    ];
    const normalized = normalizeAlertWidgetConfig(cfg);
    expect(normalized).toEqual(cfg);
    expect(normalizeAlertWidgetConfig(alertWidgetItemConfigSchema.parse(cfg))).toEqual(cfg);
  });

  it("drops a variation saved on an alert that takes none", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const stray = createAlertVariation("cheer", cfg.variants.cheer, "v1", "Stray");
    const out = normalizeAlertWidgetConfig({
      ...cfg,
      variants: { ...cfg.variants, follow: { ...cfg.variants.follow, variations: [stray] } },
    });
    expect(out.variants.follow.variations).toEqual([]);
  });

  it("turns a condition the alert cannot have into no condition", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const raw = { ...createAlertVariation("cheer", cfg.variants.cheer, "v1", "x") };
    const cond = (event: AlertEventType, condition: unknown) =>
      normalizeAlertWidgetConfig({
        ...cfg,
        variants: { ...cfg.variants, [event]: { ...cfg.variants[event], variations: [{ ...raw, condition }] } },
      }).variants[event].variations[0]!.condition;

    // A tier on a cheer, a record on a watch streak, junk.
    expect(cond("cheer", { parameter: "tier", tier: "3000" })).toEqual({ parameter: "none" });
    expect(cond("watch_streak", { parameter: "amount", operator: "session_top", value: 5 })).toEqual({
      parameter: "amount",
      operator: "at_least",
      value: 5,
    });
    expect(cond("cheer", "nonsense")).toEqual({ parameter: "none" });
    expect(cond("cheer", { parameter: "amount", operator: "at_least", value: -5 })).toEqual(atLeast(0));
  });

  it("cleans usernames and holds the limits", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const raw = createAlertVariation("cheer", cfg.variants.cheer, "v1", "x");
    const out = normalizeAlertWidgetConfig({
      ...cfg,
      variants: {
        ...cfg.variants,
        cheer: {
          ...cfg.variants.cheer,
          variations: [
            { ...raw, name: "n".repeat(200), chance: 250, condition: { parameter: "name", names: [" @ToastCrumb ", "toastcrumb", "", 7, "NineToad"] } },
            ...Array.from({ length: 30 }, (_, i) => ({ ...raw, id: `extra-${i}` })),
          ],
        },
      },
    }).variants.cheer.variations;

    expect(out).toHaveLength(20);
    expect(out[0]!.name).toHaveLength(60);
    expect(out[0]!.chance).toBe(100);
    expect(out[0]!.condition).toEqual({ parameter: "name", names: ["toastcrumb", "ninetoad"] });
  });

  it("gives variations that lost or share an id one of their own, the same on every read", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const raw = createAlertVariation("cheer", cfg.variants.cheer, "same", "x");
    const read = () =>
      normalizeAlertWidgetConfig({
        ...cfg,
        variants: { ...cfg.variants, cheer: { ...cfg.variants.cheer, variations: [raw, raw, { ...raw, id: "" }] } },
      }).variants.cheer.variations.map((v) => v.id);
    expect(new Set(read()).size).toBe(3);
    expect(read()).toEqual(read());
  });
});

describe("a variation's condition in plain words", () => {
  const say = (event: AlertEventType, condition: AlertVariationCondition, chance = 100) =>
    alertVariationSummary(event, {
      ...createAlertVariation(event, createDefaultAlertVariantConfig(event), "v", "v"),
      condition,
      chance,
    });

  it("names the unit and the comparison", () => {
    expect(say("cheer", atLeast(1000))).toBe("Bits: at least 1000");
    expect(say("resub", { parameter: "amount", operator: "exact", value: 12 })).toBe("Months: exactly 12");
    expect(say("raid", { parameter: "amount", operator: "session_top", value: 0 })).toBe("Viewers: biggest of the stream");
    expect(say("cheer", { parameter: "amount", operator: "session_top", value: 500 })).toBe(
      "Bits: biggest of the stream, at least 500"
    );
  });

  it("names the tier and the viewers", () => {
    expect(say("sub", { parameter: "tier", tier: "prime" })).toBe("Sub tier: Prime");
    expect(say("sub", { parameter: "tier", tier: "3000" })).toBe("Sub tier: Tier 3");
    expect(say("cheer", { parameter: "name", names: ["toastcrumb", "ninetoad"] })).toBe("Viewer: toastcrumb, ninetoad");
    expect(say("cheer", { parameter: "name", names: ["a", "b", "c", "d", "e"] })).toBe("Viewer: a, b, c and 2 more");
    expect(say("cheer", { parameter: "name", names: [] })).toBe("Viewer: nobody yet");
  });

  it("adds how often, when it is not every time", () => {
    expect(say("cheer", atLeast(100), 25)).toBe("Bits: at least 100 · 25% of the time");
    expect(say("cheer", atLeast(100), 12.5)).toBe("Bits: at least 100 · 12.5% of the time");
    expect(say("cheer", { parameter: "none" })).toBe("Every time");
    expect(say("cheer", { parameter: "none" }, 10)).toBe("10% of the time");
  });
});

// ─── Animation ──────────────────────────────────────────────────────────────

describe("the effect lists", () => {
  it("offers none plus 32 entrances, and an exit mirroring each one", () => {
    expect(ALERT_ENTER_ANIMATIONS).toHaveLength(33);
    expect(ALERT_EXIT_ANIMATIONS).toHaveLength(33);
    expect(ALERT_ENTER_ANIMATIONS[0]).toBe("none");
    expect(ALERT_EXIT_ANIMATIONS.map((e) => e.replace("_out", "_in"))).toEqual([...ALERT_ENTER_ANIMATIONS]);
  });

  it("offers none plus ten highlight loops", () => {
    expect([...ALERT_HIGHLIGHT_ANIMATIONS]).toEqual([
      "none", "bounce", "flash", "pulse", "rubber_band", "tada", "wave", "wiggle", "wobble", "swing", "shake",
    ]);
  });

  it("has keyframes for every effect it offers, under a name of its own", () => {
    const all = [...ALERT_ENTER_ANIMATIONS, ...ALERT_EXIT_ANIMATIONS, ...ALERT_HIGHLIGHT_ANIMATIONS];
    for (const effect of all) {
      if (effect === "none") continue;
      const css = alertEffectKeyframes([effect]);
      expect(css.startsWith(`@keyframes sw-fx-${effect.replaceAll("_", "-")}{`)).toBe(true);
      // Balanced, so one effect cannot swallow the next in the same <style>.
      expect(css.split("{").length).toBe(css.split("}").length);
    }
  });

  it("writes only the keyframes asked for, each once, and nothing for none", () => {
    expect(alertEffectKeyframes(["none"])).toBe("");
    const css = alertEffectKeyframes(["zoom_in", "fade_out", "zoom_in", "none"]);
    expect(css.match(/@keyframes/g)).toHaveLength(2);
  });

  it("plays an entrance once and holds it, and loops a highlight", () => {
    expect(alertEffectStyle("zoom_in", 500)).toEqual({ animation: "sw-fx-zoom-in 500ms ease both" });
    expect(alertEffectStyle("pulse", 1000, true)).toEqual({ animation: "sw-fx-pulse 1000ms ease infinite" });
    // The effects that pivot or flip carry what the keyframes alone do not.
    expect(alertEffectStyle("swing", 1000, true)?.transformOrigin).toBe("top center");
    expect(alertEffectStyle("flip_in_x", 500)?.backfaceVisibility).toBe("visible");
    expect(alertEffectStyle("light_speed_in", 500)?.animation).toContain("ease-out");
  });

  it("has nothing to play for none, or with no time to play it in", () => {
    expect(alertEffectStyle("none", 500)).toBeNull();
    expect(alertEffectStyle("zoom_in", 0)).toBeNull();
  });
});

describe("alerts saved before the full effect list", () => {
  it("reads each old entrance and exit as its nearest effect", () => {
    expect(migrateAlertAnimationIn("fade", "none")).toBe("fade_in");
    expect(migrateAlertAnimationIn("slide_up", "none")).toBe("fade_in_up");
    expect(migrateAlertAnimationIn("slide_down", "none")).toBe("fade_in_down");
    expect(migrateAlertAnimationIn("zoom", "none")).toBe("zoom_in");
    expect(migrateAlertAnimationIn("bounce", "none")).toBe("bounce_in");
    expect(migrateAlertAnimationOut("fade", "none")).toBe("fade_out");
    expect(migrateAlertAnimationOut("slide_down", "none")).toBe("fade_out_down");
    expect(migrateAlertAnimationOut("zoom", "none")).toBe("zoom_out");
  });

  it("keeps a current effect and falls back on junk", () => {
    expect(migrateAlertAnimationIn("roll_in", "none")).toBe("roll_in");
    expect(migrateAlertAnimationIn("explode", "zoom_in")).toBe("zoom_in");
    expect(migrateAlertAnimationOut(7, "fade_out")).toBe("fade_out");
    // An exit is not an entrance.
    expect(migrateAlertAnimationIn("roll_out", "zoom_in")).toBe("zoom_in");
  });

  it("gives them the speeds the alert box always had, and no text or highlight motion", () => {
    const old = normalizeAlertWidgetConfig({
      variants: { follow: { enabled: true, animationIn: "bounce", animationOut: "zoom" } },
    }).variants.follow;
    expect(old.animationIn).toBe("bounce_in");
    expect(old.animationInSeconds).toBe(0.5);
    expect(old.animationOut).toBe("zoom_out");
    expect(old.animationOutSeconds).toBe(0.35);
    expect(old.textAnimationIn).toBe("none");
    expect(old.textAnimationOut).toBe("none");
    expect(old.textDelaySeconds).toBe(0);
    expect(old.textEarlyExitSeconds).toBe(0);
    expect(old.highlightAnimation).toBe("none");
  });

  it("still saves: the schema takes the old names and writes the new ones", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const legacy = {
      ...cfg,
      variants: { ...cfg.variants, follow: { ...cfg.variants.follow, animationIn: "zoom", animationOut: "fade" } },
    };
    const saved = alertWidgetItemConfigSchema.parse(legacy);
    expect(saved.variants.follow?.animationIn).toBe("zoom_in");
    expect(saved.variants.follow?.animationOut).toBe("fade_out");
  });

  it("keeps the new settings through normalize and the save schema", () => {
    const cfg = createDefaultAlertWidgetConfig();
    cfg.waitForSound = true;
    cfg.variants.cheer = {
      ...cfg.variants.cheer,
      animationIn: "roll_in",
      animationInSeconds: 1.2,
      animationOut: "light_speed_out",
      animationOutSeconds: 0.8,
      textAnimationIn: "fade_in_up",
      textAnimationInSeconds: 0.6,
      textAnimationOut: "fade_out_down",
      textAnimationOutSeconds: 0.4,
      textDelaySeconds: 1.5,
      textEarlyExitSeconds: 2,
      highlightAnimation: "tada",
    };
    expect(normalizeAlertWidgetConfig(cfg)).toEqual(cfg);
    expect(normalizeAlertWidgetConfig(alertWidgetItemConfigSchema.parse(cfg))).toEqual(cfg);
  });

  it("holds every animation time between 0 and 10 seconds", () => {
    const cfg = createDefaultAlertWidgetConfig();
    const out = normalizeAlertWidgetConfig({
      ...cfg,
      variants: {
        ...cfg.variants,
        follow: { ...cfg.variants.follow, animationInSeconds: -3, textDelaySeconds: 99, textEarlyExitSeconds: "soon" },
      },
    }).variants.follow;
    expect(out.animationInSeconds).toBe(0);
    expect(out.textDelaySeconds).toBe(10);
    expect(out.textEarlyExitSeconds).toBe(0);
  });

  it("copies the motion along with the rest of a look", () => {
    const cfg = createDefaultAlertWidgetConfig();
    cfg.variants.follow = { ...cfg.variants.follow, animationIn: "roll_in", textDelaySeconds: 2, highlightAnimation: "wave" };
    const copied = applyAlertLookToAll(cfg, "follow");
    expect(copied.variants.cheer.animationIn).toBe("roll_in");
    expect(copied.variants.cheer.textDelaySeconds).toBe(2);
    expect(copied.variants.cheer.highlightAnimation).toBe("wave");
  });
});

describe("an alert's schedule", () => {
  const base = createDefaultAlertVariantConfig("follow");

  it("runs the entrance inside the time on screen and the exit after it", () => {
    const t = alertTimeline({ ...base, animationInSeconds: 1, animationOutSeconds: 1 }, 10_000);
    expect(t.enterMs).toBe(1000);
    expect(t.outAtMs).toBe(10_000);
    expect(t.exitMs).toBe(1000);
    // Ten seconds on screen, then a one second exit: eleven in all.
    expect(t.endAtMs).toBe(11_000);
  });

  it("gives an effect set to none no time at all", () => {
    const t = alertTimeline(
      { ...base, animationIn: "none", animationInSeconds: 3, animationOut: "none", animationOutSeconds: 3 },
      10_000
    );
    expect(t.enterMs).toBe(0);
    expect(t.exitMs).toBe(0);
    expect(t.endAtMs).toBe(10_000);
  });

  it("brings the text in after its delay and takes it out early", () => {
    const t = alertTimeline(
      {
        ...base,
        textAnimationIn: "fade_in",
        textAnimationInSeconds: 1,
        textAnimationOut: "fade_out",
        textAnimationOutSeconds: 0.5,
        textDelaySeconds: 1.5,
        textEarlyExitSeconds: 2,
      },
      10_000
    );
    expect(t.textInAtMs).toBe(1500);
    expect(t.textEnterMs).toBe(1000);
    expect(t.textOutAtMs).toBe(8000);
    expect(t.textExitMs).toBe(500);
  });

  it("has the text there from the start and to the end when nothing says otherwise", () => {
    const t = alertTimeline(base, 6000);
    expect(t.textInAtMs).toBe(0);
    expect(t.textOutAtMs).toBe(6000);
    expect(t.textEnterMs).toBe(0);
    expect(t.textExitMs).toBe(0);
  });

  it("never takes the text out before it came in, nor in after the alert left", () => {
    // A two second alert with a five second delay: the text gets no screen time.
    const late = alertTimeline({ ...base, textDelaySeconds: 5 }, 2000);
    expect(late.textInAtMs).toBe(2000);
    expect(late.textOutAtMs).toBe(2000);
    // Leaving eight seconds early on a three second alert is leaving at once.
    const early = alertTimeline({ ...base, textDelaySeconds: 1, textEarlyExitSeconds: 8 }, 3000);
    expect(early.textOutAtMs).toBe(1000);
  });
});
