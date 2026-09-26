"use client";

import { useRef, useState } from "react";
import { Flame, Loader2, Play, RotateCcw } from "lucide-react";
import {
  Button,
  ColorPicker,
  Input,
  Label,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import {
  EmoteCodePicker,
  FontWeightSelect,
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import { buildWidgetTestEvent } from "@repo/schemas";
import {
  COMBO_PREVIEW_EVENT,
  COMBO_WIDGET_LIMITS,
  COMBO_WIDGET_PRESETS,
  COMBO_WIDGET_PRESET_LABELS,
  COMBO_WIDGET_TEXT_TOKENS,
  EMOTE_WIDGET_EMOTE_PROVIDERS,
  createDefaultComboWidgetConfig,
  normalizeComboMilestones,
  normalizeComboWidgetConfig,
  normalizeEmoteWidgetHiddenUsers,
  type ComboPreviewDetail,
  type ComboWidgetCountMode,
  type ComboWidgetItemConfig,
  type ComboWidgetLayout,
  type ComboWidgetMode,
  type ComboWidgetPreset,
} from "@repo/ui/overlay";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { useListDraft } from "../emote/emote-list-fields";

const PROVIDER_LABELS = { "7tv": "7TV", bttv: "BTTV", ffz: "FFZ" } as const;

const MODE_OPTIONS: readonly SegmentedOption<ComboWidgetMode>[] = [
  { value: "time_window", label: "Time window" },
  { value: "back_to_back", label: "Back to back" },
];

const PRESET_OPTIONS: readonly SegmentedOption<ComboWidgetPreset>[] = COMBO_WIDGET_PRESETS.map((p) => ({
  value: p,
  label: COMBO_WIDGET_PRESET_LABELS[p],
}));

const LAYOUT_OPTIONS: readonly SegmentedOption<ComboWidgetLayout>[] = [
  { value: "vertical", label: "Stacked" },
  { value: "horizontal", label: "In a row" },
];

/** Test combo: this many chatters, this far apart. */
const TEST_CHATTERS = 6;
const TEST_EVERY_MS = 400;

/** One Kappa from a given viewer, so each test chatter counts once. */
function kappaMessage(userName: string): Record<string, unknown> {
  const payload = buildWidgetTestEvent("channel.chat.message", { userName }, "emotes").payload;
  return {
    ...payload,
    message: {
      text: "Kappa",
      fragments: [{ type: "emote", text: "Kappa", emote: { id: "25", emote_set_id: "0" } }],
    },
  };
}

export function ComboWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeComboWidgetConfig(item.config);
  const { fire } = useDemoFire();
  const [testing, setTesting] = useState(false);
  const cancelRef = useRef(false);
  const [hiddenDraft, setHiddenDraft] = useListDraft(cfg.hiddenUsers, item.id, "\n");
  const [milestoneDraft, setMilestoneDraft] = useListDraft(cfg.milestones.map(String), item.id, " ");

  function patchConfig(updates: Partial<ComboWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function commitHiddenUsers() {
    const hiddenUsers = normalizeEmoteWidgetHiddenUsers(hiddenDraft.split(/[\s,]+/));
    setHiddenDraft(hiddenUsers.join("\n"));
    if (hiddenUsers.join(",") !== cfg.hiddenUsers.join(",")) patchConfig({ hiddenUsers });
  }

  function commitMilestones() {
    const milestones = normalizeComboMilestones(milestoneDraft.split(/[\s,]+/).filter(Boolean).map(Number));
    setMilestoneDraft(milestones.join(" "));
    if (milestones.join(",") !== cfg.milestones.join(",")) patchConfig({ milestones });
  }

  function insertToken(token: string) {
    patchConfig({ text: `${cfg.text}{${token}}`.slice(0, COMBO_WIDGET_LIMITS.text) });
  }

  function preview() {
    window.dispatchEvent(
      new CustomEvent<ComboPreviewDetail>(COMBO_PREVIEW_EVENT, { detail: { itemId: item.id } }),
    );
  }

  /**
   * Sends real test chat through the demo path (so its Local/Live switch
   * applies), from different viewers, enough to pass the threshold.
   */
  async function startTestCombo() {
    setTesting(true);
    cancelRef.current = false;
    const run = Math.random().toString(36).slice(2, 6);
    const chatters = Math.max(TEST_CHATTERS, cfg.threshold + 3);
    try {
      for (let i = 0; i < chatters && !cancelRef.current; i++) {
        await fire({ type: "channel.chat.message", custom: kappaMessage(`Tester_${run}_${i + 1}`) });
        await new Promise((r) => setTimeout(r, TEST_EVERY_MS));
      }
    } finally {
      setTesting(false);
    }
  }

  const enabledProviders = EMOTE_WIDGET_EMOTE_PROVIDERS.filter((p) => cfg.emoteProviders[p]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={startTestCombo} disabled={testing}>
          {testing ? <Loader2 className="animate-spin" /> : <Flame />}
          Start a test combo
        </Button>
        <Button variant="outline" size="sm" onClick={preview} aria-label="Preview the animation">
          <Play />
          Preview
        </Button>
      </div>

      <InspectorSection title="Combo" defaultOpen>
        <div className="space-y-4">
          <SegmentedField
            id="combo-mode"
            label="Counts when"
            hint="Time window: every message with the emote counts while chat keeps it going, whatever else is said in between. Back to back: only messages in a row count, and any other message breaks it."
            value={cfg.mode}
            options={MODE_OPTIONS}
            onChange={(mode) => patchConfig({ mode })}
          />
          <SliderField
            id="combo-window"
            label={cfg.mode === "time_window" ? "Time window" : "Ends after quiet for"}
            unit="s"
            hint="The combo ends when nobody sends the emote for this long."
            value={cfg.windowSeconds}
            min={COMBO_WIDGET_LIMITS.windowSeconds.min}
            max={COMBO_WIDGET_LIMITS.windowSeconds.max}
            onChange={(windowSeconds) => patchConfig({ windowSeconds })}
          />
          <SliderField
            id="combo-threshold"
            label="Shows from"
            hint="The combo appears once it reaches this count."
            value={cfg.threshold}
            min={COMBO_WIDGET_LIMITS.threshold.min}
            max={COMBO_WIDGET_LIMITS.threshold.max}
            onChange={(threshold) => patchConfig({ threshold })}
          />
          <SwitchField
            id="combo-unique"
            label="Count each viewer once"
            hint="On: the number is how many people joined in, so one person spamming can't pump it. Off: every message counts."
            checked={cfg.countMode === "unique"}
            onCheckedChange={(on) => patchConfig({ countMode: (on ? "unique" : "every") as ComboWidgetCountMode })}
          />
          <SliderField
            id="combo-max"
            label="Combos on screen"
            hint="With more than one, the biggest combos show. A new emote takes a spot once it passes the smallest one."
            value={cfg.maxCombos}
            min={COMBO_WIDGET_LIMITS.maxCombos.min}
            max={COMBO_WIDGET_LIMITS.maxCombos.max}
            onChange={(maxCombos) => patchConfig({ maxCombos })}
          />
          <InspectorReveal show={cfg.maxCombos > 1} marginTop={0}>
            <SegmentedField
              id="combo-layout"
              label="Line up"
              value={cfg.layout}
              options={LAYOUT_OPTIONS}
              onChange={(layout) => patchConfig({ layout })}
            />
          </InspectorReveal>
          <SliderField
            id="combo-linger"
            label="Final count stays"
            unit="s"
            value={cfg.lingerSeconds}
            min={COMBO_WIDGET_LIMITS.lingerSeconds.min}
            max={COMBO_WIDGET_LIMITS.lingerSeconds.max}
            onChange={(lingerSeconds) => patchConfig({ lingerSeconds })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Look" defaultOpen>
        <div className="space-y-4">
          <SegmentedField
            id="combo-preset"
            label="Style"
            value={cfg.preset}
            options={PRESET_OPTIONS}
            onChange={(preset) => patchConfig({ preset })}
          />
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="combo-text" className="text-xs">
                Text
              </Label>
              <InspectorHint label="About the text">
                Words in braces get filled in, so {"x{count} COMBO"} becomes &quot;x12 COMBO&quot;.
              </InspectorHint>
            </div>
            <Input
              id="combo-text"
              value={cfg.text}
              onChange={(e) => patchConfig({ text: e.target.value })}
              className="h-9 font-mono text-sm"
              placeholder="x{count} COMBO"
              maxLength={COMBO_WIDGET_LIMITS.text}
            />
            <div className="flex flex-wrap gap-1">
              {COMBO_WIDGET_TEXT_TOKENS.map((token) => (
                <Button
                  key={token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 font-mono text-[11px]"
                  onClick={() => insertToken(token)}
                >
                  {`{${token}}`}
                </Button>
              ))}
            </div>
          </div>
          <SliderField
            id="combo-emote-size"
            label="Emote size"
            unit="px"
            value={cfg.emoteSize}
            min={COMBO_WIDGET_LIMITS.emoteSize.min}
            max={COMBO_WIDGET_LIMITS.emoteSize.max}
            onChange={(emoteSize) => patchConfig({ emoteSize })}
          />
          <GoogleFontSelect
            id="combo-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <SliderField
            id="combo-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={COMBO_WIDGET_LIMITS.fontSize.min}
            max={COMBO_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <FontWeightSelect
            id="combo-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Text color</Label>
              <ColorPicker value={cfg.color} onChange={(color) => patchConfig({ color })} aria-label="Text color" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Count color</Label>
              <ColorPicker
                value={cfg.accentColor}
                onChange={(accentColor) => patchConfig({ accentColor })}
                aria-label="Count color"
              />
            </div>
          </div>
          <SwitchField
            id="combo-shadow"
            label="Text shadow"
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="combo-milestones" className="text-xs">
                Milestones
              </Label>
              <InspectorHint label="About milestones">
                Counts that get a bigger punch, and the count glows brighter after each one. Split by spaces, up to 5.
              </InspectorHint>
            </div>
            <Input
              id="combo-milestones"
              value={milestoneDraft}
              onChange={(e) => setMilestoneDraft(e.target.value)}
              onBlur={commitMilestones}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMilestones();
              }}
              className="h-9 font-mono text-sm"
              placeholder="10 25 50"
            />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Filters">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label id="combo-providers-label" className="text-xs">
                Emote sets
              </Label>
              <InspectorHint label="About emote sets">
                Twitch emotes always count. These add your channel&apos;s third-party sets.
              </InspectorHint>
            </div>
            <ToggleGroup
              type="multiple"
              value={enabledProviders}
              onValueChange={(values) =>
                patchConfig({
                  emoteProviders: Object.fromEntries(
                    EMOTE_WIDGET_EMOTE_PROVIDERS.map((p) => [p, values.includes(p)]),
                  ) as ComboWidgetItemConfig["emoteProviders"],
                })
              }
              variant="outline"
              size="sm"
              aria-labelledby="combo-providers-label"
              className="w-full"
            >
              {EMOTE_WIDGET_EMOTE_PROVIDERS.map((provider) => (
                <ToggleGroupItem key={provider} value={provider} className="flex-1 shrink text-xs">
                  {PROVIDER_LABELS[provider]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <SwitchField
            id="combo-hide-commands"
            label="Skip !commands"
            hint="Messages that start with !, like !discord, don't count."
            checked={cfg.hideCommands}
            onCheckedChange={(hideCommands) => patchConfig({ hideCommands })}
          />
          <EmoteCodePicker
            id="combo-blocked"
            label="Blocked emotes"
            hint="These never start a combo."
            value={cfg.blockedEmotes}
            onChange={(blockedEmotes) => patchConfig({ blockedEmotes })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="combo-hidden-users" className="text-xs">
                  Hidden accounts
                </Label>
                <InspectorHint label="About hidden accounts">
                  One Twitch username per line. Common bots are in here already.
                </InspectorHint>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{cfg.hiddenUsers.length}</span>
            </div>
            <Textarea
              id="combo-hidden-users"
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
        onClick={() => patchConfig(createDefaultComboWidgetConfig())}
      >
        <RotateCcw />
        Reset to defaults
      </Button>
    </div>
  );
}
