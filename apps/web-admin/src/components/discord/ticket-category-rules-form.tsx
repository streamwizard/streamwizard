"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, NativeSelect, NativeSelectOption, Switch } from "@repo/ui";
import { saveTicketCategoryRulesAction, type TicketCategoryRulesInput } from "@/actions/discord-ticket-config";
import type { PickerOption } from "@/lib/discord/options";
import { MultiPicker } from "./pickers";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

interface TicketCategoryRulesFormProps {
  categoryId: string;
  initial: TicketCategoryRulesInput;
  roles: PickerOption[];
  /** The server-wide staff role's name, for the hints. Null when none is set. */
  staffRoleName: string | null;
  limitMax: number;
}

// Discord's own slowmode steps, in seconds.
const SLOWMODE = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];
const COOLDOWN = [0, 60, 300, 900, 3600, 21600, 86400, 604800];

const duration = (seconds: number): string => {
  if (seconds === 0) return "Off";
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${seconds / 60} ${seconds === 60 ? "minute" : "minutes"}`;
  if (seconds < 86400) return `${seconds / 3600} ${seconds === 3600 ? "hour" : "hours"}`;
  return `${seconds / 86400} ${seconds === 86400 ? "day" : "days"}`;
};

/** A stored value that isn't one of the steps (set some other way) still has to show up as selected. */
const withCurrent = (steps: number[], current: number) => (steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b));

/** Who works this category's tickets, who may open them, and how many. */
export function TicketCategoryRulesForm({ categoryId, initial, roles, staffRoleName, limitMax }: TicketCategoryRulesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const set = <K extends keyof TicketCategoryRulesInput>(key: K, value: TicketCategoryRulesInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const staff = staffRoleName ? `the ${staffRoleName} role` : "the staff role";

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketCategoryRulesAction(categoryId, values), "Category saved.")) router.refresh();
    });

  const numberRow = (key: "memberLimit" | "totalLimit", id: string) => (
    <Input
      id={id}
      type="number"
      min={1}
      max={limitMax}
      className="w-28"
      value={values[key] ?? ""}
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10);
        set(key, Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), limitMax) : null);
      }}
      placeholder="No limit"
      disabled={saving}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Staff and limits</CardTitle>
        <CardDescription>Applies to new tickets. Open ones keep the permissions they have until they are moved or claimed.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="category-staff"
          label="Extra staff roles"
          hint={`On top of ${staff}, which sees every ticket. These see and work this category only.`}
        >
          <MultiPicker
            id="category-staff"
            options={roles}
            value={values.staffRoleIds}
            onChange={(v) => set("staffRoleIds", v)}
            placeholder="None"
            emptyText="No roles match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow
          htmlFor="category-ping"
          label="Ping on a new ticket"
          hint={`Mentioned in the ticket's first message. Empty pings ${staff}.`}
        >
          <MultiPicker
            id="category-ping"
            options={roles}
            value={values.pingRoleIds}
            onChange={(v) => set("pingRoleIds", v)}
            placeholder={staffRoleName ?? "The staff role"}
            emptyText="No roles match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow
          htmlFor="category-required"
          label="Roles needed to open one"
          hint="A member needs every role listed. Empty lets anyone in."
        >
          <MultiPicker
            id="category-required"
            options={roles}
            value={values.requiredRoleIds}
            onChange={(v) => set("requiredRoleIds", v)}
            placeholder="Anyone"
            emptyText="No roles match"
            disabled={saving}
          />
        </SettingRow>
        <SettingRow htmlFor="category-claiming" label="Claiming" hint="Off removes the Claim button from this category's tickets.">
          <Switch
            id="category-claiming"
            checked={values.claimingEnabled}
            onCheckedChange={(v) => set("claimingEnabled", v)}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow
          htmlFor="category-feedback"
          label="Ask for a rating"
          hint="The closing DM gets five rating buttons and an optional comment. Needs the closing DM to be on."
        >
          <Switch
            id="category-feedback"
            checked={values.feedbackEnabled}
            onCheckedChange={(v) => set("feedbackEnabled", v)}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow htmlFor="category-member-limit" label="Open tickets per member" hint="In this category. Empty means no limit.">
          {numberRow("memberLimit", "category-member-limit")}
        </SettingRow>
        <SettingRow
          htmlFor="category-total-limit"
          label="Open tickets in total"
          hint={`Past this the category says it is full. A Discord category holds ${limitMax} channels.`}
        >
          {numberRow("totalLimit", "category-total-limit")}
        </SettingRow>
        <SettingRow htmlFor="category-cooldown" label="Wait between tickets" hint="Per member, counted from their last ticket here.">
          <NativeSelect
            id="category-cooldown"
            value={values.cooldownSeconds}
            onChange={(event) => set("cooldownSeconds", Number(event.target.value))}
            disabled={saving}
          >
            {withCurrent(COOLDOWN, values.cooldownSeconds).map((seconds) => (
              <NativeSelectOption key={seconds} value={seconds}>
                {duration(seconds)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingRow>
        <SettingRow htmlFor="category-slowmode" label="Slowmode in the ticket" hint="Discord's slowmode on the ticket channel. Members who can manage messages aren't slowed.">
          <NativeSelect
            id="category-slowmode"
            value={values.slowmodeSeconds}
            onChange={(event) => set("slowmodeSeconds", Number(event.target.value))}
            disabled={saving}
          >
            {withCurrent(SLOWMODE, values.slowmodeSeconds).map((seconds) => (
              <NativeSelectOption key={seconds} value={seconds}>
                {duration(seconds)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingRow>
        <SettingRow
          htmlFor="category-channel-name"
          label="Channel name"
          hint="[ticket.number], [member.name] and [ticket.category] are filled in. Discord lowercases names and turns spaces into dashes."
        >
          <Input
            id="category-channel-name"
            value={values.channelNameTemplate}
            onChange={(event) => set("channelNameTemplate", event.target.value.toLowerCase())}
            maxLength={100}
            className="font-mono text-sm"
            disabled={saving}
          />
        </SettingRow>
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
      </CardContent>
    </Card>
  );
}
