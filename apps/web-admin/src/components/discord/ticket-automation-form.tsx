"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  WORKING_DAYS,
  WORKING_RANGES_PER_DAY,
  workingHoursIssues,
  type WorkingDay,
  type WorkingHours,
} from "@repo/supabase/queries/ticket-hours";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  RadioGroup,
  RadioGroupItem,
} from "@repo/ui";
import { saveTicketAutomation, type TicketAutomationInput } from "@/actions/discord-tickets";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

/** The timers an admin can pick. Hours, so the bot and the database speak the same unit. */
const HOUR_OPTIONS: { value: number; label: string }[] = [
  { value: 6, label: "6 hours" },
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
  off,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  /** Offer "Off" (null) as the first option. */
  off?: boolean;
}) {
  return (
    <NativeSelect
      id={id}
      value={value === null ? "" : String(value)}
      onChange={(event) => onChange(event.target.value === "" ? null : Number.parseInt(event.target.value, 10))}
      disabled={disabled}
      className="w-40"
    >
      {off && <NativeSelectOption value="">Off</NativeSelectOption>}
      {HOUR_OPTIONS.map((option) => (
        <NativeSelectOption key={option.value} value={String(option.value)}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

const CLOSE_MODES: { value: TicketAutomationInput["closeMode"]; label: string; hint: string }[] = [
  { value: "staff_only", label: "Staff only", hint: "Members can't close tickets. They ask in the channel." },
  {
    value: "request",
    label: "Members ask, staff decide",
    hint: "The ticket card gets a Request close button. Staff accept or keep it open, here or in Discord.",
  },
  { value: "either", label: "Staff or the opener", hint: "The opener can close their own ticket straight away." },
];

const DAY_LABELS: Record<WorkingDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

interface TicketAutomationFormProps {
  initial: TicketAutomationInput;
}

/** What the bot does to tickets on its own, who may close one, and when staff are around. */
export function TicketAutomationForm({ initial }: TicketAutomationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const issues = workingHoursIssues(values.workingHours as WorkingHours);
  const set = <K extends keyof TicketAutomationInput>(key: K, value: TicketAutomationInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketAutomation(values), "Automation saved.")) router.refresh();
    });

  return (
    <div className="space-y-6">
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
            <HoursSelect id="stale-after" off value={values.staleAfterHours} onChange={(v) => set("staleAfterHours", v)} disabled={saving} />
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
              off
              value={values.autoCloseAfterHours}
              onChange={(v) => set("autoCloseAfterHours", v)}
              disabled={saving || values.staleAfterHours === null}
            />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who closes a ticket</CardTitle>
          <CardDescription>Staff can always close a ticket. This is about the person who opened it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={values.closeMode} onValueChange={(v) => set("closeMode", v as TicketAutomationInput["closeMode"])} disabled={saving}>
            {CLOSE_MODES.map((mode) => (
              <div key={mode.value} className="flex items-start gap-3">
                <RadioGroupItem id={`close-mode-${mode.value}`} value={mode.value} className="mt-0.5" />
                <Label htmlFor={`close-mode-${mode.value}`} className="grid gap-0.5 font-normal">
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-xs text-muted-foreground">{mode.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {values.closeMode === "request" && (
            <div className="divide-y border-t pt-3">
              <SettingRow
                htmlFor="request-hours"
                label="A request waits for"
                hint="Unanswered after this, the request lapses and the ticket simply stays open."
              >
                <HoursSelect id="request-hours" value={values.closeRequestHours} onChange={(v) => set("closeRequestHours", v ?? 24)} disabled={saving} />
              </SettingRow>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working hours</CardTitle>
          <CardDescription>
            When staff are around. A ticket opened outside these hours gets a line saying when to expect someone. Leave every day
            empty to never send it. Up to {WORKING_RANGES_PER_DAY} ranges per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <WorkingHoursEditor value={values.workingHours as WorkingHours} onChange={(v) => set("workingHours", v)} disabled={saving} />
          {issues.length > 0 && (
            <ul className="text-xs text-destructive">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SaveBar dirty={dirty && issues.length === 0} pending={saving} onSave={save} onReset={() => setValues(initial)} />
    </div>
  );
}

function WorkingHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: WorkingHours;
  onChange: (value: WorkingHours) => void;
  disabled?: boolean;
}) {
  // The browser's own list; falls back to the stored zone alone where the API is missing.
  const zones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return supported.includes(value.timezone) ? supported : [value.timezone, ...supported];
  }, [value.timezone]);

  const setDay = (day: WorkingDay, ranges: WorkingHours["days"][WorkingDay]) =>
    onChange({ ...value, days: { ...value.days, [day]: ranges } });

  return (
    <div className="space-y-4">
      <SettingRow htmlFor="working-timezone" label="Time zone" hint="The hours below are in this zone.">
        <NativeSelect
          id="working-timezone"
          value={value.timezone}
          onChange={(event) => onChange({ ...value, timezone: event.target.value })}
          disabled={disabled}
          className="w-full sm:w-64"
        >
          {zones.map((zone) => (
            <NativeSelectOption key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingRow>
      <div className="divide-y">
        {WORKING_DAYS.map((day) => {
          const ranges = value.days[day];
          return (
            <div key={day} className="grid gap-2 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
              <span className="pt-1.5 text-sm font-medium">{DAY_LABELS[day]}</span>
              <div className="space-y-2">
                {ranges.length === 0 && <p className="pt-1.5 text-xs text-muted-foreground">Away all day</p>}
                {ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[day]} range ${index + 1} start`}
                      value={range.start}
                      onChange={(event) => setDay(day, ranges.map((r, i) => (i === index ? { ...r, start: event.target.value } : r)))}
                      disabled={disabled}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[day]} range ${index + 1} end`}
                      value={range.end}
                      onChange={(event) => setDay(day, ranges.map((r, i) => (i === index ? { ...r, end: event.target.value } : r)))}
                      disabled={disabled}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${DAY_LABELS[day]} range ${index + 1}`}
                      disabled={disabled}
                      onClick={() => setDay(day, ranges.filter((_, i) => i !== index))}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {ranges.length < WORKING_RANGES_PER_DAY && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setDay(day, [...ranges, ranges.length === 0 ? { start: "09:00", end: "17:00" } : { start: "13:00", end: "17:00" }])}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {ranges.length === 0 ? "Add hours" : "Add a second range"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
