"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from "@repo/ui";
import { cn } from "@repo/ui";
import { AlertTriangle } from "lucide-react";
import type { Scene, SceneItem } from "@/hooks/use-obs-websocket";
import { upsertAutoSwitcherConfig, type AutoSwitcherConfigRow } from "@/actions/supabase/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@/schemas/auto-switcher";

const PRESET_COPY: Record<AutoSwitcherSensitivityPreset, { title: string; blurb: string }> = {
  relaxed: { title: "Relaxed", blurb: "Waits ~6s of bad signal before switching, ~30s stable before switching back. Fewest false alarms." },
  balanced: { title: "Balanced", blurb: "Switches after ~3s bad, back after ~20s stable. The right pick for most IRL setups." },
  fast: { title: "Fast", blurb: "Switches after ~2s bad, back after ~10s stable. For when a single frozen frame is one too many." },
};

interface AutoSwitcherFormProps {
  initialConfig: AutoSwitcherConfigRow | null;
  scenes: Scene[];
  sceneItems: Record<string, SceneItem[]>;
  obsConnected: boolean;
}

function defaultsFrom(row: AutoSwitcherConfigRow | null): AutoSwitcherFormValues {
  return {
    enabled: row?.enabled ?? false,
    mode: (row?.mode as "simple" | "advanced") ?? "simple",
    scene_model: (row?.scene_model as "two" | "three") ?? "three",
    scene_live_uuid: row?.scene_live_uuid ?? null,
    scene_live_name: row?.scene_live_name ?? null,
    scene_degraded_uuid: row?.scene_degraded_uuid ?? null,
    scene_degraded_name: row?.scene_degraded_name ?? null,
    scene_offline_uuid: row?.scene_offline_uuid ?? null,
    scene_offline_name: row?.scene_offline_name ?? null,
    sensitivity_preset: (row?.sensitivity_preset as AutoSwitcherSensitivityPreset) ?? "balanced",
    advanced_thresholds: (row?.advanced_thresholds as AutoSwitcherThresholds | null) ?? null,
    pinned_stream_key_label: row?.pinned_stream_key_label ?? null,
    log_events_enabled: row?.log_events_enabled ?? true,
    chat_notices_enabled: row?.chat_notices_enabled ?? false,
    chat_template_degraded: row?.chat_template_degraded ?? "Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)",
    chat_template_offline: row?.chat_template_offline ?? "Stream signal lost — hang tight!",
    chat_template_recovered: row?.chat_template_recovered ?? "Signal restored — back live!",
    warning_source_enabled: row?.warning_source_enabled ?? false,
    warning_source_uuid: row?.warning_source_uuid ?? null,
    warning_source_name: row?.warning_source_name ?? null,
    auto_stop_enabled: row?.auto_stop_enabled ?? false,
    auto_stop_minutes: row?.auto_stop_minutes ?? 10,
  };
}

export function AutoSwitcherForm({ initialConfig, scenes, sceneItems, obsConnected }: AutoSwitcherFormProps) {
  const form = useForm<AutoSwitcherFormValues>({
    resolver: zodResolver(autoSwitcherFormSchema),
    defaultValues: defaultsFrom(initialConfig),
  });

  const enabled = form.watch("enabled");
  const mode = form.watch("mode");
  const sceneModel = form.watch("scene_model");
  const preset = form.watch("sensitivity_preset");
  const chatNotices = form.watch("chat_notices_enabled");
  const warningSource = form.watch("warning_source_enabled");
  const autoStop = form.watch("auto_stop_enabled");
  const liveSceneUuid = form.watch("scene_live_uuid");

  const liveScene = scenes.find((s) => s.sceneUuid === liveSceneUuid);
  const liveSceneSources = liveScene ? (sceneItems[liveScene.sceneName] ?? []) : [];

  function onSubmit(values: AutoSwitcherFormValues) {
    // Names are display-only (uuids drive OBS) — refresh them from the live
    // scene list so a renamed scene shows its current name everywhere.
    const synced = { ...values };
    if (scenes.length > 0) {
      const nameOf = (uuid: string | null) => scenes.find((s) => s.sceneUuid === uuid)?.sceneName ?? null;
      synced.scene_live_name = nameOf(synced.scene_live_uuid) ?? synced.scene_live_name;
      synced.scene_degraded_name = nameOf(synced.scene_degraded_uuid) ?? synced.scene_degraded_name;
      synced.scene_offline_name = nameOf(synced.scene_offline_uuid) ?? synced.scene_offline_name;
    }
    toast.promise(
      upsertAutoSwitcherConfig(synced).then((result) => {
        if (!result.ok) throw new Error(result.error);
        return result;
      }),
      {
        loading: "Saving switcher settings…",
        success: "Saved. The switcher picks this up within a second.",
        error: (err: Error) => err.message || "Could not save settings",
      },
    );
  }

  function setMode(next: "simple" | "advanced") {
    form.setValue("mode", next, { shouldDirty: true });
    if (next === "advanced" && !form.getValues("advanced_thresholds")) {
      // Start the matrix from whatever preset was active so switching modes
      // never silently changes behavior.
      form.setValue("advanced_thresholds", { ...AUTO_SWITCHER_PRESET_THRESHOLDS[preset] }, { shouldDirty: true });
    }
  }

  const sceneSelectDisabled = !obsConnected && scenes.length === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Auto switcher</CardTitle>
                <CardDescription>
                  Watches your incoming IRL signal and switches scenes when it drops — then switches back once it&apos;s stable again.
                </CardDescription>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardHeader>

          {enabled ? (
            <CardContent className="space-y-6">
              {sceneSelectDisabled ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Connect to your cloud OBS first — scene pickers need the live scene list.
                </p>
              ) : null}

              {/* Scene model */}
              <FormField
                control={form.control}
                name="scene_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How many scenes should it manage?</FormLabel>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                        <Label className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", field.value === "two" && "border-primary")}>
                          <RadioGroupItem value="two" className="mt-0.5" />
                          <span>
                            <span className="font-medium">2 scenes</span>
                            <span className="block text-xs text-muted-foreground">Live + Connection lost. Simple: signal is either good enough or it isn&apos;t.</span>
                          </span>
                        </Label>
                        <Label className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", field.value === "three" && "border-primary")}>
                          <RadioGroupItem value="three" className="mt-0.5" />
                          <span>
                            <span className="font-medium">3 scenes</span>
                            <span className="block text-xs text-muted-foreground">Live + Low bitrate + Connection lost. Rough-but-alive gets its own scene.</span>
                          </span>
                        </Label>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Scene pickers */}
              <div className="grid gap-4 sm:grid-cols-3">
                <SceneSelect form={form} name="scene_live_uuid" label="Live scene" hint="Where your IRL feed lives" scenes={scenes} disabled={sceneSelectDisabled} />
                {sceneModel === "three" ? (
                  <SceneSelect form={form} name="scene_degraded_uuid" label="Low bitrate scene" hint="Shown when the link is rough but alive" scenes={scenes} disabled={sceneSelectDisabled} />
                ) : null}
                <SceneSelect form={form} name="scene_offline_uuid" label="Connection lost scene" hint="Shown when the signal is gone" scenes={scenes} disabled={sceneSelectDisabled} />
              </div>

              <Separator />

              {/* Simple vs advanced */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Advanced mode</p>
                  <p className="text-xs text-muted-foreground">Tune every threshold yourself instead of using a preset.</p>
                </div>
                <Switch checked={mode === "advanced"} onCheckedChange={(on) => setMode(on ? "advanced" : "simple")} />
              </div>

              {mode === "simple" ? (
                <FormField
                  control={form.control}
                  name="sensitivity_preset"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How trigger-happy should it be?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-3">
                          {(Object.keys(PRESET_COPY) as AutoSwitcherSensitivityPreset[]).map((key) => (
                            <Label key={key} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", field.value === key && "border-primary")}>
                              <RadioGroupItem value={key} className="mt-0.5" />
                              <span>
                                <span className="font-medium">{PRESET_COPY[key].title}</span>
                                <span className="block text-xs text-muted-foreground">{PRESET_COPY[key].blurb}</span>
                              </span>
                            </Label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : (
                <AdvancedThresholdsMatrix form={form} />
              )}

              <Separator />

              {/* Features */}
              <div className="space-y-4">
                <FeatureToggle
                  form={form}
                  name="log_events_enabled"
                  title="Log switches to your stream events"
                  description="Every switch shows up in your activity feed and VOD timeline, with the reason it happened."
                />

                <FeatureToggle
                  form={form}
                  name="chat_notices_enabled"
                  title="Post in Twitch chat when it switches"
                  description="The StreamWizard bot tells chat what's going on. {bitrate}, {rtt}, {loss} and {scene} get filled in."
                />
                {chatNotices ? (
                  <div className="grid gap-3 pl-4 sm:grid-cols-3">
                    <ChatTemplateField form={form} name="chat_template_degraded" label="Quality dropped" />
                    <ChatTemplateField form={form} name="chat_template_offline" label="Signal lost" />
                    <ChatTemplateField form={form} name="chat_template_recovered" label="Back live" />
                  </div>
                ) : null}

                <FeatureToggle
                  form={form}
                  name="warning_source_enabled"
                  title="Show a warning source before switching"
                  description="Flashes a source in your live scene (like an 'unstable connection' banner) when quality dips, before a full switch."
                />
                {warningSource ? (
                  <div className="pl-4">
                    <FormField
                      control={form.control}
                      name="warning_source_uuid"
                      render={({ field }) => (
                        <FormItem className="max-w-xs">
                          <FormLabel>Warning source (in your live scene)</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(uuid) => {
                              field.onChange(uuid);
                              form.setValue("warning_source_name", liveSceneSources.find((i) => i.sourceUuid === uuid)?.sourceName ?? null);
                            }}
                            disabled={liveSceneSources.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={liveSceneSources.length ? "Pick a source" : "Pick your live scene first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {liveSceneSources.map((item) => (
                                <SelectItem key={item.sourceUuid} value={item.sourceUuid}>
                                  {item.sourceName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}

                <FeatureToggle
                  form={form}
                  name="auto_stop_enabled"
                  title="Stop the stream after a long outage"
                  description="No point broadcasting a BRB loop for three hours. Stops the OBS stream output after the signal has been gone this long."
                />
                {autoStop ? (
                  <div className="pl-4">
                    <FormField
                      control={form.control}
                      name="auto_stop_minutes"
                      render={({ field }) => (
                        <FormItem className="max-w-40">
                          <FormLabel>Minutes offline</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={120} value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="pinned_stream_key_label"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Only watch one camera (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Stream key label, e.g. Camera 1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormDescription>Leave empty to always watch your most recent stream.</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save switcher settings
        </Button>
      </form>
    </Form>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SceneSelect({ form, name, label, hint, scenes, disabled }: { form: any; name: "scene_live_uuid" | "scene_degraded_uuid" | "scene_offline_uuid"; label: string; hint: string; scenes: Scene[]; disabled: boolean }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const missing = field.value && scenes.length > 0 && !scenes.some((s) => s.sceneUuid === field.value);
        const storedName = form.getValues(name.replace("_uuid", "_name"));
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={disabled}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={disabled ? "OBS not connected" : "Pick a scene"}>
                    {scenes.find((s) => s.sceneUuid === field.value)?.sceneName ?? storedName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {scenes.map((scene) => (
                  <SelectItem key={scene.sceneUuid} value={scene.sceneUuid}>
                    {scene.sceneName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>{hint}</FormDescription>
            {missing ? (
              <p className="text-xs text-destructive">
                &quot;{storedName ?? "This scene"}&quot; no longer exists in OBS — pick it again.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeatureToggle({ form, name, title, description }: { form: any; name: keyof AutoSwitcherFormValues; title: string; description: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-4">
          <div>
            <FormLabel>{title}</FormLabel>
            <FormDescription>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChatTemplateField({ form, name, label }: { form: any; name: keyof AutoSwitcherFormValues; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Textarea rows={2} value={field.value ?? ""} onChange={field.onChange} maxLength={400} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const MATRIX_ROWS = [
  { key: "bitrate", label: "Bitrate", unit: "min kbps", value: "bitrate_min_kbps", trigger: "bitrate_trigger_polls", recover: "bitrate_recover_polls", startup: "bitrate_startup_polls" },
  { key: "rtt", label: "Ping (RTT)", unit: "max ms", value: "rtt_max_ms", trigger: "rtt_trigger_polls", recover: "rtt_recover_polls", startup: "rtt_startup_polls" },
  { key: "loss", label: "Packet loss", unit: "max %", value: "loss_max_pct", trigger: "loss_trigger_polls", recover: "loss_recover_polls", startup: "loss_startup_polls" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AdvancedThresholdsMatrix({ form }: { form: any }) {
  const thresholds = (form.watch("advanced_thresholds") ?? null) as AutoSwitcherThresholds | null;
  if (!thresholds) return null;

  const set = (key: keyof AutoSwitcherThresholds, raw: string) => {
    const value = Number(raw);
    form.setValue("advanced_thresholds", { ...thresholds, [key]: Number.isFinite(value) ? value : 0 }, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        One sample arrives per second. Trigger/recover/startup are how many seconds in a row a value must be bad (or good) before the switcher acts.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3 font-normal">Metric</th>
              <th className="py-1 pr-3 font-normal">Limit</th>
              <th className="py-1 pr-3 font-normal">Trigger (s bad)</th>
              <th className="py-1 pr-3 font-normal">Recover (s good)</th>
              <th className="py-1 pr-3 font-normal">Startup (s good)</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="py-1 pr-3">
                  {row.label} <span className="text-xs text-muted-foreground">({row.unit})</span>
                </td>
                {([row.value, row.trigger, row.recover, row.startup] as (keyof AutoSwitcherThresholds)[]).map((key) => (
                  <td key={key} className="py-1 pr-3">
                    <Input type="number" className="h-8 w-24" value={thresholds[key]} onChange={(e) => set(key, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="max-w-52">
        <Label className="text-xs">Offline after (seconds of silence)</Label>
        <Input
          type="number"
          className="mt-1 h-8"
          value={thresholds.offline_timeout_seconds}
          onChange={(e) => set("offline_timeout_seconds", e.target.value)}
        />
      </div>
    </div>
  );
}
