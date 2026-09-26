"use client";

import { useState } from "react";
import { Loader2, MessageSquarePlus, Play, RotateCcw } from "lucide-react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import {
  EmoteCodePicker,
  EmotePicker,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SliderField,
  SwitchField,
} from "@/components/overlays/inspector-fields";
import {
  EMOTE_ANIMATIONS,
  EMOTE_ANIMATION_LABELS,
  EMOTE_PREVIEW_EVENT,
  EMOTE_WIDGET_EMOTE_PROVIDERS,
  EMOTE_WIDGET_EVENTS,
  EMOTE_WIDGET_EVENT_LABELS,
  EMOTE_WIDGET_LIMITS,
  createDefaultEmoteWidgetConfig,
  normalizeEmoteWidgetConfig,
  normalizeEmoteWidgetHiddenUsers,
  type EmoteAnimation,
  type EmotePreviewDetail,
  type EmoteWidgetBurst,
  type EmoteWidgetEvent,
  type EmoteWidgetItemConfig,
} from "@repo/ui/overlay";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import type { DemoFireRequest } from "@/components/demo/demo-fire";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { useListDraft } from "./emote-list-fields";

const PROVIDER_LABELS = { "7tv": "7TV", bttv: "BTTV", ffz: "FFZ" } as const;

/** The test event each burst row fires. */
const EVENT_TESTS: Record<EmoteWidgetEvent, DemoFireRequest> = {
  follow: { type: "channel.follow" },
  sub: { type: "channel.subscribe" },
  resub: { type: "channel.subscription.message" },
  gift: { type: "channel.subscription.gift" },
  cheer: { type: "channel.cheer" },
  raid: { type: "channel.raid" },
};

function AnimationSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: EmoteAnimation;
  onChange: (value: EmoteAnimation) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EmoteAnimation)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EMOTE_ANIMATIONS.map((a) => (
          <SelectItem key={a} value={a}>
            {EMOTE_ANIMATION_LABELS[a]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EmoteWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeEmoteWidgetConfig(item.config);
  const { fire } = useDemoFire();
  const [busy, setBusy] = useState<string | null>(null);
  const [hiddenDraft, setHiddenDraft] = useListDraft(cfg.hiddenUsers, item.id, "\n");

  function patchConfig(updates: Partial<EmoteWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchBurst(event: EmoteWidgetEvent, updates: Partial<EmoteWidgetBurst>) {
    patchConfig({ events: { ...cfg.events, [event]: { ...cfg.events[event], ...updates } } });
  }

  function commitHiddenUsers() {
    const hiddenUsers = normalizeEmoteWidgetHiddenUsers(hiddenDraft.split(/[\s,]+/));
    setHiddenDraft(hiddenUsers.join("\n"));
    if (hiddenUsers.join(",") !== cfg.hiddenUsers.join(",")) patchConfig({ hiddenUsers });
  }

  function preview(animation: EmoteAnimation, count: number) {
    window.dispatchEvent(
      new CustomEvent<EmotePreviewDetail>(EMOTE_PREVIEW_EVENT, {
        detail: { itemId: item.id, animation, count },
      }),
    );
  }

  async function test(key: string, request: DemoFireRequest) {
    // Same path as the demo bar, so its Local/Live switch applies here too.
    setBusy(key);
    try {
      await fire(request);
    } finally {
      setBusy(null);
    }
  }

  const enabledProviders = EMOTE_WIDGET_EMOTE_PROVIDERS.filter((p) => cfg.emoteProviders[p]);

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={busy !== null}
        onClick={() => test("chat", { type: "channel.chat.message", variant: "emotes" })}
      >
        {busy === "chat" ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
        Send a test message
      </Button>

      <InspectorSection title="Chat emotes" defaultOpen>
        <div className="space-y-4">
          <SwitchField
            id="emote-chat"
            label="Show emotes from chat"
            hint="Every emote someone types flies across the screen."
            checked={cfg.chatEnabled}
            onCheckedChange={(chatEnabled) => patchConfig({ chatEnabled })}
          />
          <InspectorReveal show={cfg.chatEnabled} marginTop={0}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="emote-animation" className="text-xs">
                  Animation
                </Label>
                <div className="flex gap-2">
                  <AnimationSelect
                    id="emote-animation"
                    value={cfg.animation}
                    onChange={(animation) => patchConfig({ animation })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Preview animation"
                    onClick={() => preview(cfg.animation, 5)}
                  >
                    <Play />
                  </Button>
                </div>
              </div>
              <SliderField
                id="emote-max-per-message"
                label="Emotes per message"
                hint="Stops one message full of emotes from taking over."
                value={cfg.maxPerMessage}
                min={EMOTE_WIDGET_LIMITS.maxPerMessage.min}
                max={EMOTE_WIDGET_LIMITS.maxPerMessage.max}
                onChange={(maxPerMessage) => patchConfig({ maxPerMessage })}
              />
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label id="emote-providers-label" className="text-xs">
                    Emote sets
                  </Label>
                  <InspectorHint label="About emote sets">
                    Twitch emotes always show. These add your channel&apos;s third-party sets.
                  </InspectorHint>
                </div>
                <ToggleGroup
                  type="multiple"
                  value={enabledProviders}
                  onValueChange={(values) =>
                    patchConfig({
                      emoteProviders: Object.fromEntries(
                        EMOTE_WIDGET_EMOTE_PROVIDERS.map((p) => [p, values.includes(p)]),
                      ) as EmoteWidgetItemConfig["emoteProviders"],
                    })
                  }
                  variant="outline"
                  size="sm"
                  aria-labelledby="emote-providers-label"
                  className="w-full"
                >
                  {EMOTE_WIDGET_EMOTE_PROVIDERS.map((provider) => (
                    <ToggleGroupItem key={provider} value={provider} className="flex-1 shrink text-xs">
                      {PROVIDER_LABELS[provider]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Events" defaultOpen>
        <div className="space-y-2">
          {EMOTE_WIDGET_EVENTS.map((event) => {
            const burst = cfg.events[event];
            return (
              <div key={event} className="space-y-3 rounded-md border p-3">
                <SwitchField
                  id={`emote-event-${event}`}
                  label={EMOTE_WIDGET_EVENT_LABELS[event]}
                  checked={burst.enabled}
                  onCheckedChange={(enabled) => patchBurst(event, { enabled })}
                />
                <InspectorReveal show={burst.enabled} marginTop={0}>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <AnimationSelect
                        id={`emote-event-${event}-animation`}
                        value={burst.animation}
                        onChange={(animation) => patchBurst(event, { animation })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={busy !== null}
                        onClick={() => test(event, EVENT_TESTS[event])}
                      >
                        {busy === event ? <Loader2 className="animate-spin" /> : <Play />}
                        Test
                      </Button>
                    </div>
                    <SliderField
                      id={`emote-event-${event}-count`}
                      label="Emotes"
                      hint={
                        event === "cheer"
                          ? "Bigger cheers send more."
                          : event === "raid"
                            ? "Bigger raids send more."
                            : event === "gift"
                              ? "More gifts send more."
                              : undefined
                      }
                      value={burst.count}
                      min={EMOTE_WIDGET_LIMITS.burstCount.min}
                      max={EMOTE_WIDGET_LIMITS.burstCount.max}
                      onChange={(count) => patchBurst(event, { count })}
                    />
                    <EmotePicker
                      id={`emote-event-${event}-emotes`}
                      label="Which emotes"
                      hint="Leave it empty to use the emotes in the viewer's message, or else your channel's own emotes."
                      value={burst.emotes}
                      emptyText="Your channel emotes"
                      max={EMOTE_WIDGET_LIMITS.emoteCodes}
                      onChange={(emotes) => patchBurst(event, { emotes })}
                    />
                  </div>
                </InspectorReveal>
              </div>
            );
          })}
        </div>
      </InspectorSection>

      <InspectorSection title="Look">
        <div className="space-y-4">
          <SliderField
            id="emote-size"
            label="Emote size"
            unit="px"
            value={cfg.emoteSize}
            min={EMOTE_WIDGET_LIMITS.emoteSize.min}
            max={EMOTE_WIDGET_LIMITS.emoteSize.max}
            onChange={(emoteSize) => patchConfig({ emoteSize })}
          />
          <SliderField
            id="emote-duration"
            label="Time on screen"
            unit="s"
            step={0.5}
            value={cfg.duration / 1000}
            min={EMOTE_WIDGET_LIMITS.duration.min / 1000}
            max={EMOTE_WIDGET_LIMITS.duration.max / 1000}
            onChange={(seconds) => patchConfig({ duration: Math.round(seconds * 1000) })}
          />
          <SliderField
            id="emote-max-on-screen"
            label="Most at once"
            hint="When there are more, the oldest go first. Lower it if OBS stutters."
            value={cfg.maxOnScreen}
            min={EMOTE_WIDGET_LIMITS.maxOnScreen.min}
            max={EMOTE_WIDGET_LIMITS.maxOnScreen.max}
            onChange={(maxOnScreen) => patchConfig({ maxOnScreen })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Filters">
        <div className="space-y-4">
          <SwitchField
            id="emote-hide-commands"
            label="Skip !commands"
            hint="Messages that start with !, like !discord, send no emotes."
            checked={cfg.hideCommands}
            onCheckedChange={(hideCommands) => patchConfig({ hideCommands })}
          />
          <SliderField
            id="emote-cooldown"
            label="Cooldown per viewer"
            unit="s"
            hint="How long before the same viewer's emotes show again. 0 is no cooldown."
            value={cfg.userCooldown}
            min={EMOTE_WIDGET_LIMITS.userCooldown.min}
            max={EMOTE_WIDGET_LIMITS.userCooldown.max}
            onChange={(userCooldown) => patchConfig({ userCooldown })}
          />
          <EmoteCodePicker
            id="emote-blocked"
            label="Blocked emotes"
            hint="These never show, from chat or in bursts."
            value={cfg.blockedEmotes}
            max={EMOTE_WIDGET_LIMITS.emoteCodes}
            onChange={(blockedEmotes) => patchConfig({ blockedEmotes })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="emote-hidden-users" className="text-xs">
                  Hidden accounts
                </Label>
                <InspectorHint label="About hidden accounts">
                  One Twitch username per line. Common bots are in here already.
                </InspectorHint>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{cfg.hiddenUsers.length}</span>
            </div>
            <Textarea
              id="emote-hidden-users"
              value={hiddenDraft}
              onChange={(e) => setHiddenDraft(e.target.value)}
              onBlur={commitHiddenUsers}
              rows={4}
              className="resize-y font-mono text-xs"
              placeholder={"nightbot\nstreamelements"}
            />
          </div>
        </div>
      </InspectorSection>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => patchConfig(createDefaultEmoteWidgetConfig())}
      >
        <RotateCcw />
        Reset to defaults
      </Button>
    </div>
  );
}
