"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PLATFORM_EVENT_GROUPS,
  PLATFORM_EVENTS,
  platformEventTypesInGroup,
  type PlatformEventGroup,
  type PlatformEventType,
} from "@repo/types";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Switch } from "@repo/ui";
import { saveLogSettings, sendTestLogEvent, type LogSettingsInput } from "@/actions/discord-logs";
import type { PickerOption } from "@/lib/discord/options";
import { MultiPicker, Picker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

const HINTS: Partial<Record<PlatformEventType, string>> = {
  "user.created": "Someone signs up for StreamWizard.",
  "user.deleted": "Someone deletes their account, or disconnects StreamWizard on Twitch.",
  "discord.linked": "A user links a Discord account.",
  "discord.unlinked": "A user unlinks their Discord account.",
  "subscription.granted": "An admin grants a plan.",
  "subscription.changed": "An admin changes a plan's status or expiry.",
  "subscription.revoked": "An admin revokes a plan.",
  "discord_settings.changed": "Anyone saves a setting in this dashboard.",
  "log.test": "The test button on this page. Always posted.",
  "member.left": "Leaving on their own. Kicks and bans have their own events.",
  "member.roles_changed": "Includes roles the bot hands out (join and verified role).",
  "message.edited": "Shows the text before and after.",
  "message.deleted": "Shows the text if the bot saw the message since its last restart.",
};

export function LogSettingsForm({
  initial,
  textChannels,
  ignorableChannels,
}: {
  initial: LogSettingsInput;
  textChannels: PickerOption[];
  ignorableChannels: PickerOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const normalise = (v: LogSettingsInput) =>
    JSON.stringify({
      ...v,
      ignoredChannelIds: [...v.ignoredChannelIds].sort(),
      events: Object.fromEntries(Object.entries(v.events).sort(([a], [b]) => a.localeCompare(b))),
    });
  const dirty = normalise(values) !== normalise(initial);

  const setEvent = (type: PlatformEventType, patch: Partial<LogSettingsInput["events"][string]>) =>
    setValues((prev) => ({ ...prev, events: { ...prev.events, [type]: { ...prev.events[type]!, ...patch } } }));

  const setGroupChannel = (group: PlatformEventGroup, channelId: string | null) =>
    setValues((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        ...Object.fromEntries(platformEventTypesInGroup(group).map((type) => [type, { ...prev.events[type]!, channelId }])),
      },
    }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveLogSettings(values), "Log settings saved.")) router.refresh();
    });

  const test = () =>
    startTest(async () => {
      if (toastResult(await sendTestLogEvent(), "Test event queued. Check the log channel.")) router.refresh();
    });

  const defaultLabel = textChannels.find((c) => c.value === values.defaultChannelId)?.label;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Channels</CardTitle>
            <CardDescription>Keep log channels staff-only: they show names, Discord ids and message text.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={test}
            disabled={testing || dirty || !initial.defaultChannelId}
            title={dirty ? "Save first" : !initial.defaultChannelId ? "Pick a default channel first" : undefined}
          >
            {testing ? "Sending…" : "Send test event"}
          </Button>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow
            htmlFor="log-default-channel"
            label="Default channel"
            hint="Events without their own channel go here. Without any channel, events are still stored and show up in the log."
          >
            <Picker
              id="log-default-channel"
              options={textChannels}
              value={values.defaultChannelId}
              onChange={(v) => setValues((prev) => ({ ...prev, defaultChannelId: v }))}
              placeholder="Pick a text channel"
              emptyText="No channels match"
              disabled={saving}
            />
          </SettingRow>
          <SettingRow
            htmlFor="log-ignored-channels"
            label="Don't log messages in"
            hint="Edits and deletes in these channels (or channels inside these categories) aren't logged. Log channels and open tickets are always skipped."
          >
            <MultiPicker
              id="log-ignored-channels"
              options={ignorableChannels}
              value={values.ignoredChannelIds}
              onChange={(v) => setValues((prev) => ({ ...prev, ignoredChannelIds: v }))}
              placeholder="Pick channels or categories"
              emptyText="No channels match"
              disabled={saving}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {PLATFORM_EVENT_GROUPS.map((group) => {
        const types = platformEventTypesInGroup(group.id);
        const channels = new Set(types.map((type) => values.events[type]?.channelId ?? null));
        const shared = channels.size === 1 ? [...channels][0]! : null;
        return (
          <Card key={group.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{group.label}</CardTitle>
                <CardDescription>{group.hint}</CardDescription>
              </div>
              <div className="w-full space-y-1 sm:w-64">
                <Label htmlFor={`group-${group.id}`} className="text-xs text-muted-foreground">
                  Channel for all {group.label.toLowerCase()} events
                </Label>
                <Picker
                  id={`group-${group.id}`}
                  options={textChannels}
                  value={shared}
                  onChange={(v) => setGroupChannel(group.id, v)}
                  placeholder={channels.size > 1 ? "Mixed" : defaultLabel ? `Default (${defaultLabel})` : "Default channel"}
                  emptyText="No channels match"
                  disabled={saving}
                />
              </div>
            </CardHeader>
            <CardContent className="divide-y">
              {types.map((type) => {
                const meta = PLATFORM_EVENTS[type];
                const route = values.events[type]!;
                return (
                  <SettingRow key={type} htmlFor={`event-${type}`} label={meta.label} hint={HINTS[type]}>
                    <div className="flex w-full items-center gap-3">
                      <Switch
                        id={`event-${type}`}
                        checked={route.enabled}
                        onCheckedChange={(v) => setEvent(type, { enabled: v })}
                        disabled={saving || ("alwaysOn" in meta && meta.alwaysOn)}
                        aria-label={`Post ${meta.label.toLowerCase()} events`}
                      />
                      <div className="min-w-0 flex-1">
                        <Picker
                          options={textChannels}
                          value={route.channelId}
                          onChange={(v) => setEvent(type, { channelId: v })}
                          placeholder={defaultLabel ? `Default (${defaultLabel})` : "Default channel"}
                          emptyText="No channels match"
                          disabled={saving || !route.enabled}
                        />
                      </div>
                    </div>
                  </SettingRow>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="sticky bottom-4 z-10 rounded-lg border bg-background/95 px-4 pb-4 shadow-sm backdrop-blur empty:hidden">
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
      </div>
    </div>
  );
}
