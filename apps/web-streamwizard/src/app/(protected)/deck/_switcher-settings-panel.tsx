"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Textarea,
  cn,
} from "@repo/ui";
import { ChevronDown } from "lucide-react";
import type { Scene, SceneItem } from "@/hooks/use-obs-websocket";
import { upsertAutoSwitcherConfig, type AutoSwitcherConfigRow } from "@/actions/supabase/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@/schemas/auto-switcher";
import { PRESET_COPY, defaultsFrom } from "@/lib/auto-switcher-form-defaults";
import { useAutoSwitcherStatus } from "@/components/irl/auto-switcher/use-auto-switcher-status";
import { SwitcherStatusStrip } from "./_switcher-status-strip";
import {
  ChoiceCards,
  PickerDrawer,
  PickerRow,
  SegmentedRow,
  SettingRow,
  SettingSection,
  StepperRow,
  SwitchRow,
  usePickerState,
} from "./_setting-row";

// Phone-shaped twin of the dashboard's AutoSwitcherForm. Same schema, same
// server action, same defaults -- only the controls differ: drawers instead of
// popover selects, steppers instead of number keyboards, one column throughout.

/** What the deck's sticky save bar needs to know. Primitives only, so the effect that reports it can't loop. */
export interface SaveBarState {
  dirty: boolean;
  submitting: boolean;
  hasErrors: boolean;
}

export interface SaveBarActions {
  save: () => void;
  discard: () => void;
}

interface SwitcherSettingsPanelProps {
  config: AutoSwitcherConfigRow | null;
  scenes: Scene[];
  sceneItems: Record<string, SceneItem[]>;
  obsConnected: boolean;
  canInteract: boolean;
  onSaved: (row: AutoSwitcherConfigRow) => void;
  onSaveBarChange: (state: SaveBarState) => void;
  actionsRef: React.MutableRefObject<SaveBarActions | null>;
}

const THRESHOLD_GROUPS = [
  {
    key: "bitrate",
    label: "Bitrate",
    limit: { field: "bitrate_min_kbps", label: "Drops below", unit: "kbps", min: 0, max: 100_000, step: 100 },
    trigger: "bitrate_trigger_polls",
    recover: "bitrate_recover_polls",
    startup: "bitrate_startup_polls",
  },
  {
    key: "rtt",
    label: "Ping (RTT)",
    limit: { field: "rtt_max_ms", label: "Climbs above", unit: "ms", min: 0, max: 10_000, step: 25 },
    trigger: "rtt_trigger_polls",
    recover: "rtt_recover_polls",
    startup: "rtt_startup_polls",
  },
  {
    key: "loss",
    label: "Packet loss",
    limit: { field: "loss_max_pct", label: "Climbs above", unit: "%", min: 0, max: 100, step: 1 },
    trigger: "loss_trigger_polls",
    recover: "loss_recover_polls",
    startup: "loss_startup_polls",
  },
] as const;

export function SwitcherSettingsPanel({
  config,
  scenes,
  sceneItems,
  obsConnected,
  canInteract,
  onSaved,
  onSaveBarChange,
  actionsRef,
}: SwitcherSettingsPanelProps) {
  const form = useForm<AutoSwitcherFormValues>({
    resolver: zodResolver(autoSwitcherFormSchema),
    defaultValues: defaultsFrom(config),
  });
  const { status } = useAutoSwitcherStatus();
  const picker = usePickerState();
  const containerRef = useRef<HTMLDivElement>(null);

  const values = form.watch();
  const errors = form.formState.errors;
  const { isDirty, isSubmitting } = form.formState;
  const hasErrors = Object.keys(errors).length > 0;

  // Report save-bar state up to the deck shell, which renders the bar above the
  // tab bar. Only primitives in the dep list, so this can't feed back into itself.
  useEffect(() => {
    onSaveBarChange({ dirty: isDirty, submitting: isSubmitting, hasErrors });
  }, [isDirty, isSubmitting, hasErrors, onSaveBarChange]);

  async function submit() {
    await form.handleSubmit(onValid, onInvalid)();
  }

  function onInvalid() {
    // Custom rows aren't focusable inputs, so RHF's shouldFocusError can't land
    // on them. Scroll the first flagged field into view ourselves.
    const first = containerRef.current?.querySelector("[data-invalid='true']");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onValid(formValues: AutoSwitcherFormValues) {
    // Names are display-only (uuids drive OBS) -- refresh them from the live
    // scene list so a renamed scene shows its current name everywhere.
    const synced = { ...formValues };
    if (scenes.length > 0) {
      const nameOf = (uuid: string | null) => scenes.find((s) => s.sceneUuid === uuid)?.sceneName ?? null;
      synced.scene_live_name = nameOf(synced.scene_live_uuid) ?? synced.scene_live_name;
      synced.scene_degraded_name = nameOf(synced.scene_degraded_uuid) ?? synced.scene_degraded_name;
      synced.scene_offline_name = nameOf(synced.scene_offline_uuid) ?? synced.scene_offline_name;
    }
    const saving = upsertAutoSwitcherConfig(synced).then((result) => {
      if (!result.ok) throw new Error(result.error);
      if (result.data) onSaved(result.data);
      // Reset to the saved values so the form stops reading as dirty.
      form.reset(defaultsFrom(result.data ?? null));
      return result;
    });
    toast.promise(saving, {
      loading: "Saving…",
      success: "Saved. The switcher picks this up within a second.",
      error: (err: Error) => err.message || "Could not save your settings",
    });
    // Await so isSubmitting (and the save bar's spinner) tracks the round-trip.
    // The toast already surfaced any failure.
    await saving.catch(() => undefined);
  }

  // Refs, not state: the deck shell reads these when the user taps Save/Discard.
  // Re-published every render so the closures never go stale.
  useEffect(() => {
    actionsRef.current = {
      save: () => void submit(),
      discard: () => form.reset(defaultsFrom(config)),
    };
  });

  const enabled = values.enabled;
  const advanced = values.mode === "advanced";
  const thresholds = values.advanced_thresholds;
  const liveScene = scenes.find((s) => s.sceneUuid === values.scene_live_uuid);
  const liveSceneSources = liveScene ? (sceneItems[liveScene.sceneName] ?? []) : [];
  const scenesUnavailable = !obsConnected && scenes.length === 0;
  const locked = !canInteract;

  const sceneOptions = scenes.map((scene) => ({ value: scene.sceneUuid, label: scene.sceneName }));

  function setThreshold(key: keyof AutoSwitcherThresholds, next: number) {
    if (!thresholds) return;
    form.setValue("advanced_thresholds", { ...thresholds, [key]: next }, { shouldDirty: true });
  }

  function setAdvanced(on: boolean) {
    form.setValue("mode", on ? "advanced" : "simple", { shouldDirty: true });
    if (on && !form.getValues("advanced_thresholds")) {
      // Seed the matrix from the active preset so flipping modes never silently
      // changes behaviour.
      form.setValue(
        "advanced_thresholds",
        { ...AUTO_SWITCHER_PRESET_THRESHOLDS[values.sensitivity_preset as AutoSwitcherSensitivityPreset] },
        { shouldDirty: true },
      );
    }
  }

  function pickScene(field: "scene_live_uuid" | "scene_degraded_uuid" | "scene_offline_uuid", uuid: string) {
    const nameField = field.replace("_uuid", "_name") as "scene_live_name" | "scene_degraded_name" | "scene_offline_name";
    form.setValue(field, uuid, { shouldDirty: true, shouldValidate: true });
    form.setValue(nameField, scenes.find((s) => s.sceneUuid === uuid)?.sceneName ?? null, { shouldDirty: true });
  }

  /** Stored name when the uuid is gone from OBS, so a deleted scene reads honestly. */
  function sceneLabel(uuid: string | null, storedName: string | null): { value: string | null; stale: boolean } {
    if (!uuid) return { value: null, stale: false };
    const live = scenes.find((s) => s.sceneUuid === uuid);
    if (live) return { value: live.sceneName, stale: false };
    if (scenes.length === 0) return { value: storedName, stale: false };
    return { value: storedName, stale: true };
  }

  const liveLabel = sceneLabel(values.scene_live_uuid, values.scene_live_name);
  const degradedLabel = sceneLabel(values.scene_degraded_uuid, values.scene_degraded_name);
  const offlineLabel = sceneLabel(values.scene_offline_uuid, values.scene_offline_name);

  const staleNote = (stale: boolean) => (stale ? "This scene is gone from OBS. Pick it again." : null);

  return (
    <div ref={containerRef} className="space-y-5">
      <SwitcherStatusStrip status={status} enabled={config?.enabled ?? false} />

      <SettingSection title="Auto switcher">
        <SwitchRow
          label="Switch scenes for me"
          description="Watches your incoming IRL signal and switches scenes when it drops, then switches back once it's stable."
          checked={enabled}
          disabled={locked}
          onCheckedChange={(next) => form.setValue("enabled", next, { shouldDirty: true, shouldValidate: true })}
        />
      </SettingSection>

      {enabled ? (
        <>
          {scenesUnavailable ? (
            <p className="px-1 text-xs text-muted-foreground">
              Connect to your cloud OBS first. The scene pickers need the live scene list.
            </p>
          ) : null}

          <SettingSection title="Scenes">
            <SegmentedRow
              label="How many scenes should it manage?"
              value={values.scene_model as "two" | "three"}
              disabled={locked}
              onChange={(next) => form.setValue("scene_model", next, { shouldDirty: true, shouldValidate: true })}
              options={[
                { value: "two", label: "2 scenes", hint: "Live + lost" },
                { value: "three", label: "3 scenes", hint: "Live + rough + lost" },
              ]}
            />

            <div data-invalid={errors.scene_live_uuid ? "true" : undefined}>
              <PickerRow
                label="Live scene"
                description="Where your IRL feed lives"
                value={liveLabel.value}
                placeholder={scenesUnavailable ? "OBS not connected" : "Pick a scene"}
                error={errors.scene_live_uuid?.message ?? staleNote(liveLabel.stale)}
                disabled={locked || scenesUnavailable}
                onOpen={() => picker.open("scene_live")}
              />
            </div>

            {values.scene_model === "three" ? (
              <div data-invalid={errors.scene_degraded_uuid ? "true" : undefined}>
                <PickerRow
                  label="Low bitrate scene"
                  description="Shown when the link is rough but alive"
                  value={degradedLabel.value}
                  placeholder={scenesUnavailable ? "OBS not connected" : "Pick a scene"}
                  error={errors.scene_degraded_uuid?.message ?? staleNote(degradedLabel.stale)}
                  disabled={locked || scenesUnavailable}
                  onOpen={() => picker.open("scene_degraded")}
                />
              </div>
            ) : null}

            <div data-invalid={errors.scene_offline_uuid ? "true" : undefined}>
              <PickerRow
                label="Connection lost scene"
                description="Shown when the signal is gone"
                value={offlineLabel.value}
                placeholder={scenesUnavailable ? "OBS not connected" : "Pick a scene"}
                error={errors.scene_offline_uuid?.message ?? staleNote(offlineLabel.stale)}
                disabled={locked || scenesUnavailable}
                onOpen={() => picker.open("scene_offline")}
              />
            </div>
          </SettingSection>

          <SettingSection title="Sensitivity">
            <SwitchRow
              label="Advanced mode"
              description="Tune every threshold yourself instead of using a preset."
              checked={advanced}
              disabled={locked}
              onCheckedChange={setAdvanced}
            />

            {advanced ? (
              <div data-invalid={errors.advanced_thresholds ? "true" : undefined}>
                {thresholds ? (
                  <div className="divide-y divide-border">
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      One sample arrives per second. Trigger, recover and startup are how many seconds in a row a value must be bad
                      (or good) before the switcher acts.
                    </p>
                    {THRESHOLD_GROUPS.map((group) => (
                      <Collapsible key={group.key}>
                        <CollapsibleTrigger className="group/threshold flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent">
                          <span className="text-sm font-medium">{group.label}</span>
                          <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                            {group.limit.label} {thresholds[group.limit.field]} {group.limit.unit}
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/threshold:rotate-180" />
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="divide-y divide-border border-t bg-muted/30">
                          <StepperRow
                            label={group.limit.label}
                            unit={group.limit.unit}
                            value={thresholds[group.limit.field]}
                            min={group.limit.min}
                            max={group.limit.max}
                            step={group.limit.step}
                            disabled={locked}
                            onChange={(next) => setThreshold(group.limit.field, next)}
                          />
                          <StepperRow
                            label="Trigger"
                            description="Seconds bad before it switches away"
                            unit="seconds"
                            value={thresholds[group.trigger]}
                            min={1}
                            max={120}
                            disabled={locked}
                            onChange={(next) => setThreshold(group.trigger, next)}
                          />
                          <StepperRow
                            label="Recover"
                            description="Seconds good before it switches back"
                            unit="seconds"
                            value={thresholds[group.recover]}
                            min={1}
                            max={300}
                            disabled={locked}
                            onChange={(next) => setThreshold(group.recover, next)}
                          />
                          <StepperRow
                            label="Startup"
                            description="Seconds good before it arms at all"
                            unit="seconds"
                            value={thresholds[group.startup]}
                            min={1}
                            max={120}
                            disabled={locked}
                            onChange={(next) => setThreshold(group.startup, next)}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                    <StepperRow
                      label="Offline after"
                      description="Seconds of silence before it calls the signal gone"
                      unit="seconds"
                      value={thresholds.offline_timeout_seconds}
                      min={2}
                      max={60}
                      disabled={locked}
                      onChange={(next) => setThreshold("offline_timeout_seconds", next)}
                    />
                  </div>
                ) : (
                  <SettingRow label="Thresholds" error={errors.advanced_thresholds?.message ?? "Advanced mode needs threshold values."} />
                )}
              </div>
            ) : (
              <ChoiceCards
                value={values.sensitivity_preset as AutoSwitcherSensitivityPreset}
                disabled={locked}
                onChange={(next) => form.setValue("sensitivity_preset", next, { shouldDirty: true })}
                options={(Object.keys(PRESET_COPY) as AutoSwitcherSensitivityPreset[]).map((key) => ({
                  value: key,
                  title: PRESET_COPY[key].title,
                  blurb: PRESET_COPY[key].blurb,
                }))}
              />
            )}
          </SettingSection>

          <SettingSection title="When it switches">
            <SwitchRow
              label="Log switches to your stream events"
              description="Every switch shows up in your activity feed and VOD timeline, with the reason it happened."
              checked={values.log_events_enabled}
              disabled={locked}
              onCheckedChange={(next) => form.setValue("log_events_enabled", next, { shouldDirty: true })}
            />

            <SwitchRow
              label="Post in Twitch chat"
              description="The StreamWizard bot tells chat what's going on. {bitrate}, {rtt}, {loss} and {scene} get filled in."
              checked={values.chat_notices_enabled}
              disabled={locked}
              onCheckedChange={(next) => form.setValue("chat_notices_enabled", next, { shouldDirty: true })}
            />
            {values.chat_notices_enabled ? (
              <Collapsible>
                <CollapsibleTrigger className="group/chat flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent">
                  <span className="text-sm font-medium">Chat messages</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]/chat:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 border-t bg-muted/30 p-4">
                  <ChatTemplate
                    label="Quality dropped"
                    value={values.chat_template_degraded}
                    disabled={locked}
                    onChange={(next) => form.setValue("chat_template_degraded", next, { shouldDirty: true })}
                  />
                  <ChatTemplate
                    label="Signal lost"
                    value={values.chat_template_offline}
                    disabled={locked}
                    onChange={(next) => form.setValue("chat_template_offline", next, { shouldDirty: true })}
                  />
                  <ChatTemplate
                    label="Back live"
                    value={values.chat_template_recovered}
                    disabled={locked}
                    onChange={(next) => form.setValue("chat_template_recovered", next, { shouldDirty: true })}
                  />
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <SwitchRow
              label="Show a warning source first"
              description="Flashes a source in your live scene (like an 'unstable connection' banner) when quality dips, before a full switch."
              checked={values.warning_source_enabled}
              disabled={locked}
              onCheckedChange={(next) => form.setValue("warning_source_enabled", next, { shouldDirty: true, shouldValidate: true })}
            />
            {values.warning_source_enabled ? (
              <div data-invalid={errors.warning_source_uuid ? "true" : undefined}>
                <PickerRow
                  label="Warning source"
                  description="Lives in your live scene"
                  value={
                    liveSceneSources.find((item) => item.sourceUuid === values.warning_source_uuid)?.sourceName ??
                    values.warning_source_name
                  }
                  placeholder={liveSceneSources.length ? "Pick a source" : "Pick your live scene first"}
                  error={errors.warning_source_uuid?.message ?? null}
                  disabled={locked || liveSceneSources.length === 0}
                  onOpen={() => picker.open("warning_source")}
                />
              </div>
            ) : null}

            <SwitchRow
              label="Stop the stream after a long outage"
              description="No point broadcasting a BRB loop for three hours. Stops the OBS stream output after the signal has been gone this long."
              checked={values.auto_stop_enabled}
              disabled={locked}
              onCheckedChange={(next) => form.setValue("auto_stop_enabled", next, { shouldDirty: true })}
            />
            {values.auto_stop_enabled ? (
              <StepperRow
                label="Minutes offline"
                unit="minutes"
                value={values.auto_stop_minutes}
                min={1}
                max={120}
                step={5}
                disabled={locked}
                onChange={(next) => form.setValue("auto_stop_minutes", next, { shouldDirty: true, shouldValidate: true })}
              />
            ) : null}
          </SettingSection>

          <SettingSection title="Which camera" description="Leave empty to always watch your most recent stream.">
            <div className="p-3">
              <Input
                className="h-12 rounded-xl"
                placeholder="Stream key label, e.g. Camera 1"
                value={values.pinned_stream_key_label ?? ""}
                disabled={locked}
                onChange={(event) =>
                  form.setValue("pinned_stream_key_label", event.target.value || null, { shouldDirty: true })
                }
              />
            </div>
          </SettingSection>
        </>
      ) : null}

      <PickerDrawer
        open={picker.isOpen("scene_live")}
        onOpenChange={picker.setOpen("scene_live")}
        title="Live scene"
        description="Where your IRL feed lives."
        options={sceneOptions}
        selected={values.scene_live_uuid}
        emptyLabel="No scenes yet. Connect to OBS first."
        onSelect={(uuid) => pickScene("scene_live_uuid", uuid)}
      />
      <PickerDrawer
        open={picker.isOpen("scene_degraded")}
        onOpenChange={picker.setOpen("scene_degraded")}
        title="Low bitrate scene"
        description="Shown when the link is rough but alive."
        options={sceneOptions}
        selected={values.scene_degraded_uuid}
        emptyLabel="No scenes yet. Connect to OBS first."
        onSelect={(uuid) => pickScene("scene_degraded_uuid", uuid)}
      />
      <PickerDrawer
        open={picker.isOpen("scene_offline")}
        onOpenChange={picker.setOpen("scene_offline")}
        title="Connection lost scene"
        description="Shown when the signal is gone."
        options={sceneOptions}
        selected={values.scene_offline_uuid}
        emptyLabel="No scenes yet. Connect to OBS first."
        onSelect={(uuid) => pickScene("scene_offline_uuid", uuid)}
      />
      <PickerDrawer
        open={picker.isOpen("warning_source")}
        onOpenChange={picker.setOpen("warning_source")}
        title="Warning source"
        description="A source in your live scene, shown before a full switch."
        options={liveSceneSources.map((item) => ({ value: item.sourceUuid, label: item.sourceName }))}
        selected={values.warning_source_uuid}
        emptyLabel="Pick your live scene first."
        onSelect={(uuid) => {
          form.setValue("warning_source_uuid", uuid, { shouldDirty: true, shouldValidate: true });
          form.setValue("warning_source_name", liveSceneSources.find((i) => i.sourceUuid === uuid)?.sourceName ?? null, {
            shouldDirty: true,
          });
        }}
      />
    </div>
  );
}

function ChatTemplate({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const [id] = useState(() => `chat-template-${label.toLowerCase().replace(/\s+/g, "-")}`);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        rows={3}
        maxLength={400}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl"
      />
      <p className={cn("text-right text-[11px] tabular-nums text-muted-foreground", value.length > 380 && "text-destructive")}>
        {value.length}/400
      </p>
    </div>
  );
}
