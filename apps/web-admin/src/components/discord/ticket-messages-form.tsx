"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DEFAULT_TICKET_MESSAGES,
  TICKET_MESSAGE_MAX,
  TICKET_MESSAGE_VARIABLES,
  type TicketMessageKey,
  type TicketMessages,
} from "@repo/discord-message";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Textarea } from "@repo/ui";
import { saveTicketMessages } from "@/actions/discord-tickets";
import { SaveBar } from "./setting-row";
import { toastResult } from "./toast-result";

interface TicketMessagesFormProps {
  initial: TicketMessages;
  dmOnClose: boolean;
  /** The stale reminder is on. */
  staleOn: boolean;
  /** Tickets close on their own after the reminder. */
  autoCloseOn: boolean;
  /** Members ask to close, staff decide. */
  closeRequestsOn: boolean;
  /** Working hours are set. */
  workingHoursOn: boolean;
}

interface MessageSection {
  key: TicketMessageKey;
  title: string;
  description: string;
  rows?: number;
  /** The switch or timer that decides whether this text is sent. It is saved on its own tab; this links there. */
  setting: {
    href: string;
    label: string;
    /** "under General": where the link leads, in words. */
    where: string;
    /** Left out when it differs per category, so there is no single answer. */
    on?: boolean;
  };
}

const SETTINGS = "/discord/tickets/settings";

/** The short texts the bot sends around a ticket. Designed messages (panel, opening) have their own pages. */
export function TicketMessagesForm({ initial, dmOnClose, staleOn, autoCloseOn, closeRequestsOn, workingHoursOn }: TicketMessagesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketMessages(values), "Messages saved.")) router.refresh();
    });

  const sections: MessageSection[] = [
    {
      key: "closeDm",
      title: "Closing message",
      description: "Sent to the opener as a DM when their ticket closes, with the conversation attached as a file.",
      rows: 6,
      setting: {
        href: `${SETTINGS}#dm-on-close`,
        label: "Message the opener when their ticket closes",
        where: "under General",
        on: dmOnClose,
      },
    },
    {
      key: "feedbackPrompt",
      title: "Rating prompt",
      description: "Added under the closing message, above the five rating buttons, for categories that ask for a rating.",
      rows: 3,
      setting: { href: `${SETTINGS}/categories`, label: "Ask for a rating", where: "on each category, under Categories" },
    },
    {
      key: "staleWarning",
      title: "Quiet-ticket reminder",
      description: "Posted in a ticket nobody has written in for a while, when tickets don't close on their own.",
      setting: { href: `${SETTINGS}/automation#stale-after`, label: "Remind after", where: "under Automation", on: staleOn },
    },
    {
      key: "closingSoon",
      title: "Quiet-ticket reminder, closing soon",
      description:
        "Used instead of the reminder above when tickets close on their own after it. Say when, so nobody is surprised.",
      setting: {
        href: `${SETTINGS}/automation#auto-close-after`,
        label: "Close after the reminder",
        where: "under Automation",
        on: autoCloseOn,
      },
    },
    {
      key: "autoClosed",
      title: "Reason for an automatic close",
      description: "Saved as the close reason and shown in the closing message when a ticket closes for inactivity.",
      rows: 2,
      setting: {
        href: `${SETTINGS}/automation#auto-close-after`,
        label: "Close after the reminder",
        where: "under Automation",
        on: autoCloseOn,
      },
    },
    {
      key: "closeRequest",
      title: "Close request",
      description: "Posted in the ticket when the opener asks to close it, above the Accept and Keep-open buttons for staff.",
      setting: {
        href: `${SETTINGS}/automation#close-mode`,
        label: "Members ask, staff decide",
        where: "under Automation",
        on: closeRequestsOn,
      },
    },
    {
      key: "workingHoursNotice",
      title: "Outside working hours",
      description:
        "Added under the opening message of a ticket opened while staff are away. [hours.next_opening] becomes a live countdown to the next working hours.",
      rows: 3,
      setting: {
        href: `${SETTINGS}/automation#working-hours`,
        label: "Working hours",
        where: "under Automation",
        on: workingHoursOn,
      },
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        // The id is what General and Automation link to; the margin keeps the title clear of the sticky header.
        <Card key={section.key} id={section.key} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
            <p className="text-sm text-muted-foreground">
              Setting:{" "}
              <Link href={section.setting.href} className="underline">
                {section.setting.label}
              </Link>
              , {section.setting.where}.
              {section.setting.on === false && " It is off right now, so this text isn't used."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`message-${section.key}`}>Text</Label>
              <Textarea
                id={`message-${section.key}`}
                value={values[section.key]}
                onChange={(event) => setValues({ ...values, [section.key]: event.target.value })}
                rows={section.rows ?? 4}
                maxLength={TICKET_MESSAGE_MAX}
                disabled={saving}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Discord formatting works. Placeholders:{" "}
                {TICKET_MESSAGE_VARIABLES[section.key].map((variable, index) => (
                  <span key={variable.key}>
                    {index > 0 && ", "}
                    <code>[{variable.key}]</code>
                  </span>
                ))}
                .
              </p>
              {/* What each one stands for used to be a hover title: no hover on a phone. */}
              <details className="text-xs text-muted-foreground">
                <summary className="w-fit cursor-pointer py-1.5 underline">What each placeholder becomes</summary>
                <ul className="grid gap-x-6 gap-y-1 pt-1 sm:grid-cols-2">
                  {TICKET_MESSAGE_VARIABLES[section.key].map((variable) => (
                    <li key={variable.key}>
                      <code>[{variable.key}]</code> {variable.label}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 md:h-8"
              disabled={saving || values[section.key] === DEFAULT_TICKET_MESSAGES[section.key]}
              onClick={() => setValues({ ...values, [section.key]: DEFAULT_TICKET_MESSAGES[section.key] })}
            >
              Use the default
            </Button>
          </CardContent>
        </Card>
      ))}
      <SaveBar sticky dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
    </div>
  );
}
