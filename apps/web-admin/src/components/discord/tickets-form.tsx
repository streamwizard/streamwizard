"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@repo/ui";
import { repostTicketPanel, saveTicketSettings, type TicketSettingsInput } from "@/actions/discord-tickets";
import type { PickerOption } from "@/lib/discord/options";
import { Picker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

interface TicketsFormProps {
  initial: TicketSettingsInput;
  textChannels: PickerOption[];
  categories: PickerOption[];
  roles: PickerOption[];
  hasPanel: boolean;
}

export function TicketsForm({ initial, textChannels, categories, roles, hasPanel }: TicketsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const [posting, startPost] = useTransition();

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const complete = !!(values.staffRoleId && values.categoryId && values.panelChannelId);
  const set = <K extends keyof TicketSettingsInput>(key: K, value: TicketSettingsInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketSettings(values), "Ticket settings saved.")) router.refresh();
    });

  const repost = () =>
    startPost(async () => {
      if (toastResult(await repostTicketPanel(), "Panel posted. The old one is gone.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Ticket setup</CardTitle>
          <CardDescription>Members open tickets from the panel. Each ticket gets a private channel in the category.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={repost}
          disabled={posting || dirty || !initial.panelChannelId}
          title={dirty ? "Save first" : !initial.panelChannelId ? "Pick a panel channel first" : undefined}
        >
          {posting ? "Posting…" : hasPanel ? "Re-post panel" : "Post panel"}
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="tickets-enabled"
          label="Accept new tickets"
          hint={complete ? "Open tickets keep working when this is off." : "Pick a staff role, category and panel channel first."}
        >
          <Switch
            id="tickets-enabled"
            checked={values.enabled}
            onCheckedChange={(v) => set("enabled", v)}
            disabled={saving || (!complete && !values.enabled)}
          />
        </SettingRow>
        <SettingRow htmlFor="staff-role" label="Staff role" hint="Can see, claim and close every ticket.">
          <Picker
            id="staff-role"
            options={roles}
            value={values.staffRoleId}
            onChange={(v) => set("staffRoleId", v)}
            placeholder="Pick a role"
            emptyText="No roles match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow htmlFor="ticket-category" label="Ticket category" hint="New ticket channels go here.">
          <Picker
            id="ticket-category"
            options={categories}
            value={values.categoryId}
            onChange={(v) => set("categoryId", v)}
            placeholder="Pick a category"
            emptyText="No categories match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow htmlFor="panel-channel" label="Panel channel" hint="Changing it posts a fresh panel there and removes the old one.">
          <Picker
            id="panel-channel"
            options={textChannels}
            value={values.panelChannelId}
            onChange={(v) => set("panelChannelId", v)}
            placeholder="Pick a channel"
            emptyText="No text channels match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow htmlFor="log-channel" label="Log channel" hint="Closed tickets get logged here. Leave empty to skip logging.">
          <Picker
            id="log-channel"
            options={textChannels}
            value={values.logChannelId}
            onChange={(v) => set("logChannelId", v)}
            placeholder="No log channel"
            emptyText="No text channels match"
            disabled={saving}
          />
        </SettingRow>
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
      </CardContent>
    </Card>
  );
}
