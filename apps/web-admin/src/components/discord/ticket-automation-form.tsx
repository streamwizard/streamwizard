"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, NativeSelect, NativeSelectOption } from "@repo/ui";
import { saveTicketAutomation, type TicketAutomationInput } from "@/actions/discord-tickets";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

/** The timers an admin can pick. Hours, so the bot and the database speak the same unit. */
export const TICKET_HOUR_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Off" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
  { value: 336, label: "2 weeks" },
];

function HoursSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSelect
      id={id}
      value={value === null ? "" : String(value)}
      onChange={(event) => onChange(event.target.value === "" ? null : Number.parseInt(event.target.value, 10))}
      disabled={disabled}
      className="w-40"
    >
      {TICKET_HOUR_OPTIONS.map((option) => (
        <NativeSelectOption key={option.label} value={option.value === null ? "" : String(option.value)}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

interface TicketAutomationFormProps {
  initial: TicketAutomationInput;
}

/** What the bot does to tickets on its own: the quiet-ticket reminder and the close that can follow it. */
export function TicketAutomationForm({ initial }: TicketAutomationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketAutomation(values), "Automation saved.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quiet tickets</CardTitle>
        <CardDescription>
          First the reminder, then the close. A ticket is only ever closed after its reminder went unanswered, and any
          reply resets both timers. The texts are under{" "}
          <Link href="/discord/tickets/settings/messages" className="underline">
            Messages
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="stale-after"
          label="Remind after"
          hint="How long a ticket can go without anyone writing before the opener gets a nudge in the channel."
        >
          <HoursSelect
            id="stale-after"
            value={values.staleAfterHours}
            onChange={(v) => setValues({ ...values, staleAfterHours: v })}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow
          htmlFor="auto-close-after"
          label="Close after the reminder"
          hint={
            values.staleAfterHours === null
              ? "Needs a reminder first: pick a time above."
              : "How long the reminder can go unanswered before the ticket closes on its own. The opener still gets the closing DM."
          }
        >
          <HoursSelect
            id="auto-close-after"
            value={values.autoCloseAfterHours}
            onChange={(v) => setValues({ ...values, autoCloseAfterHours: v })}
            disabled={saving || values.staleAfterHours === null}
          />
        </SettingRow>
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
      </CardContent>
    </Card>
  );
}
