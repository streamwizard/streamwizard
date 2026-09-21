"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@repo/ui";
import { createLiveRole, saveLiveSettings, type LiveSettingsInput } from "@/actions/discord-live";
import type { PickerOption } from "@/lib/discord/options";
import { Picker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

interface LiveFormProps {
  initial: LiveSettingsInput;
  channels: PickerOption[];
  roles: PickerOption[];
  /** Roles without "display separately": picking one of these gets a hint, since the point is the member list. */
  unhoistedRoleIds: string[];
}

export function LiveForm({ initial, channels, roles, unhoistedRoleIds }: LiveFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const [creating, startCreate] = useTransition();

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const busy = saving || creating;
  const set = <K extends keyof LiveSettingsInput>(key: K, value: LiveSettingsInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveLiveSettings(values), "Go-live settings saved.")) router.refresh();
    });

  const create = () =>
    startCreate(async () => {
      if (toastResult(await createLiveRole(), "Live role created and picked.")) router.refresh();
    });

  const roleNotHoisted = Boolean(values.liveRoleId && unhoistedRoleIds.includes(values.liveRoleId));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Go-live posts</CardTitle>
          <CardDescription>
            One post per stream for every linked user who hasn&apos;t switched it off. It follows title and category changes and updates itself when the stream ends.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow htmlFor="live-enabled" label="Post go-live messages">
            <Switch id="live-enabled" checked={values.liveEnabled} onCheckedChange={(v) => set("liveEnabled", v)} disabled={busy} />
          </SettingRow>
          <SettingRow htmlFor="live-channel" label="Live channel" hint="Where go-live posts land. Text or announcement channels.">
            <Picker
              id="live-channel"
              options={channels}
              value={values.liveChannelId}
              onChange={(v) => set("liveChannelId", v)}
              placeholder="Pick a channel"
              emptyText="No channels match"
              disabled={busy}
            />
          </SettingRow>
          <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live role</CardTitle>
          <CardDescription>
            Linked users get this role while they stream and lose it when they go offline. With &ldquo;Display role members separately&rdquo; on, they sit at the top of the member list. Works on its own, with or without posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow
            htmlFor="live-role"
            label="Role"
            hint={
              roleNotHoisted ? (
                <span className="text-amber-600 dark:text-amber-400">
                  This role isn&apos;t set to display separately, so live streamers won&apos;t show at the top. Turn it on in Server Settings, Roles.
                </span>
              ) : (
                "Leave empty to switch the live role off. The bot needs Manage Roles and a role above this one."
              )
            }
          >
            <Picker
              id="live-role"
              options={roles}
              value={values.liveRoleId}
              onChange={(v) => set("liveRoleId", v)}
              placeholder="No live role"
              emptyText="No roles match"
              disabled={busy}
            />
          </SettingRow>
          {!values.liveRoleId && (
            <SettingRow label="No role yet?" hint="Makes a purple “Live” role that displays separately, and picks it.">
              <Button size="sm" variant="outline" onClick={create} disabled={busy || dirty}>
                {creating ? "Creating…" : "Create a Live role"}
              </Button>
            </SettingRow>
          )}
          <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
        </CardContent>
      </Card>
    </>
  );
}
