"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@repo/ui";
import { saveWelcomeSettings, sendTestWelcome, type WelcomeSettingsInput } from "@/actions/discord-welcome";
import type { PickerOption } from "@/lib/discord/options";
import { Picker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

interface WelcomeFormProps {
  initial: WelcomeSettingsInput;
  channels: PickerOption[];
  roles: PickerOption[];
  systemChannelName: string | null;
}

export function WelcomeForm({ initial, channels, roles, systemChannelName }: WelcomeFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = <K extends keyof WelcomeSettingsInput>(key: K, value: WelcomeSettingsInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveWelcomeSettings(values), "Welcome settings saved.")) router.refresh();
    });

  const test = () =>
    startTest(async () => {
      const result = await sendTestWelcome();
      const note = result.welcomeEnabled === false ? " Welcome messages are off, so real joins won't get one." : "";
      toastResult(result, `Test welcome sent. Go check Discord.${note}`);
    });

  return (
    <div className="space-y-4">
      <Card>
        {/* The button drops under the title on a phone instead of squeezing it. */}
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">New members</CardTitle>
            <CardDescription>What happens when someone joins the server.</CardDescription>
          </div>
          <div className="shrink-0 space-y-1 sm:text-right">
            <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={test} disabled={testing || dirty}>
              {testing ? "Sending…" : "Send test welcome"}
            </Button>
            {dirty && <p className="text-xs text-muted-foreground">Save your changes first.</p>}
          </div>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow htmlFor="welcome-enabled" label="Send welcome messages">
            <Switch id="welcome-enabled" checked={values.welcomeEnabled} onCheckedChange={(v) => set("welcomeEnabled", v)} disabled={saving} />
          </SettingRow>
          <SettingRow
            htmlFor="welcome-channel"
            label="Welcome channel"
            hint={
              systemChannelName
                ? `Leave empty to use the server's system channel (${systemChannelName}). Switching channels deletes the old welcome messages.`
                : "Leave empty to use the server's system channel. This server doesn't have one, so pick a channel."
            }
          >
            <Picker
              id="welcome-channel"
              options={channels}
              value={values.welcomeChannelId}
              onChange={(v) => set("welcomeChannelId", v)}
              placeholder="System channel"
              emptyText="No text channels match"
              disabled={saving}
            />
          </SettingRow>
          <SettingRow
            htmlFor="join-role"
            label="Join role"
            hint="Given to everyone who joins, even with welcome messages off. Bots don't get it, and people who joined before keep what they have."
          >
            <Picker
              id="join-role"
              options={roles}
              value={values.joinRoleId}
              onChange={(v) => set("joinRoleId", v)}
              placeholder="No join role"
              emptyText="No roles match"
              disabled={saving}
            />
          </SettingRow>
          <SettingRow
            htmlFor="verified-role"
            label="Verified role"
            hint="Given to members who link their StreamWizard account. Changing it moves everyone who has the old role to the new one."
          >
            <Picker
              id="verified-role"
              options={roles}
              value={values.verifiedRoleId}
              onChange={(v) => set("verifiedRoleId", v)}
              placeholder="No verified role"
              emptyText="No roles match"
              disabled={saving}
            />
          </SettingRow>
        </CardContent>
      </Card>
      <SaveBar sticky dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
    </div>
  );
}
