"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@repo/ui";
import { saveActivitySettings, type ActivitySettingsInput } from "@/actions/discord-activity";
import type { PickerOption } from "@/lib/discord/options";
import { MultiPicker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

type Toggle = Exclude<keyof ActivitySettingsInput, "ignoredChannelIds">;

const TRACKED: { key: Toggle; label: string; hint: string; voiceOnly?: boolean }[] = [
  { key: "trackMessages", label: "Count messages", hint: "Only the count. The bot never reads message content." },
  { key: "trackReactions", label: "Count reactions", hint: "Reactions members add." },
  { key: "trackVoice", label: "Track voice time", hint: "Time spent in voice channels." },
  {
    key: "voiceIgnoreAfk",
    label: "Skip muted or deafened members",
    hint: "Muted or deafened time doesn't count, whether they did it or a mod did.",
    voiceOnly: true,
  },
  {
    key: "voiceRequireOthers",
    label: "Skip members alone in voice",
    hint: "Voice time only counts with at least one other person (bots don't count).",
    voiceOnly: true,
  },
];

export function ActivityForm({ initial, channels }: { initial: ActivitySettingsInput; channels: PickerOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();

  const normalise = (v: ActivitySettingsInput) => JSON.stringify({ ...v, ignoredChannelIds: [...v.ignoredChannelIds].sort() });
  const dirty = normalise(values) !== normalise(initial);
  const set = <K extends keyof ActivitySettingsInput>(key: K, value: ActivitySettingsInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveActivitySettings(values), "Activity settings saved.")) router.refresh();
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity tracking</CardTitle>
          <CardDescription>Feeds /rank, /leaderboard, /recap and /serverstats.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow htmlFor="tracking-enabled" label="Track activity" hint="Turning this off stops all counting and closes open voice sessions.">
            <Switch
              id="tracking-enabled"
              checked={values.trackingEnabled}
              onCheckedChange={(v) => set("trackingEnabled", v)}
              disabled={saving}
            />
          </SettingRow>
          {TRACKED.map(({ key, label, hint, voiceOnly }) => (
            <SettingRow key={key} htmlFor={key} label={label} hint={hint}>
              <Switch
                id={key}
                checked={values[key]}
                onCheckedChange={(v) => set(key, v)}
                disabled={saving || !values.trackingEnabled || (voiceOnly && !values.trackVoice)}
              />
            </SettingRow>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ignored channels</CardTitle>
          <CardDescription>Nothing in these channels counts. Ignoring a category covers every channel inside it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultiPicker
            id="ignored-channels"
            options={channels}
            value={values.ignoredChannelIds}
            onChange={(v) => set("ignoredChannelIds", v)}
            placeholder="Pick channels or categories"
            emptyText="No channels match"
            disabled={saving}
          />
          <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
        </CardContent>
      </Card>
    </div>
  );
}
