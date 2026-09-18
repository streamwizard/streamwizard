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
}

interface MessageSection {
  key: TicketMessageKey;
  title: string;
  description: React.ReactNode;
  rows?: number;
}

const settingsLink = (href: string, label: string) => (
  <Link href={`/discord/tickets/settings/${href}`} className="underline">
    {label}
  </Link>
);

/** The short texts the bot sends around a ticket. Designed messages (panel, opening) have their own pages. */
export function TicketMessagesForm({ initial, dmOnClose, staleOn, autoCloseOn }: TicketMessagesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketMessages(values), "Messages saved.")) router.refresh();
    });

  const off = (what: string, where: React.ReactNode) => (
    <>
      {" "}
      {what} is off right now; switch it on under {where}.
    </>
  );

  const sections: MessageSection[] = [
    {
      key: "closeDm",
      title: "Closing message",
      description: (
        <>
          Sent to the opener as a DM when their ticket closes, with the conversation attached as a file.
          {dmOnClose ? null : off("It", settingsLink("", "General"))}
        </>
      ),
      rows: 6,
    },
    {
      key: "staleWarning",
      title: "Quiet-ticket reminder",
      description: (
        <>
          Posted in a ticket nobody has written in for a while, when tickets don&apos;t close on their own.
          {staleOn ? null : off("The reminder", settingsLink("automation", "Automation"))}
        </>
      ),
    },
    {
      key: "closingSoon",
      title: "Quiet-ticket reminder, closing soon",
      description: (
        <>
          Used instead of the reminder above when tickets close on their own after it. Say when, so nobody is surprised.
          {autoCloseOn ? null : off("Closing on its own", settingsLink("automation", "Automation"))}
        </>
      ),
    },
    {
      key: "autoClosed",
      title: "Reason for an automatic close",
      description: "Saved as the close reason and shown in the closing message when a ticket closes for inactivity.",
      rows: 2,
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
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
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Discord formatting works. Placeholders:{" "}
                {TICKET_MESSAGE_VARIABLES[section.key].map((variable, index) => (
                  <span key={variable.key}>
                    {index > 0 && ", "}
                    <code title={variable.label}>[{variable.key}]</code>
                  </span>
                ))}
                .
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving || values[section.key] === DEFAULT_TICKET_MESSAGES[section.key]}
              onClick={() => setValues({ ...values, [section.key]: DEFAULT_TICKET_MESSAGES[section.key] })}
            >
              Use the default
            </Button>
          </CardContent>
        </Card>
      ))}
      <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
    </div>
  );
}
