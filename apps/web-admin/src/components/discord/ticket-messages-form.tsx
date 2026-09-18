"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_TICKET_MESSAGES, TICKET_CLOSE_VARIABLES, TICKET_MESSAGE_MAX, type TicketMessages } from "@repo/discord-message";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Textarea } from "@repo/ui";
import { saveTicketMessages } from "@/actions/discord-tickets";
import { SaveBar } from "./setting-row";
import { toastResult } from "./toast-result";

interface TicketMessagesFormProps {
  initial: TicketMessages;
  dmOnClose: boolean;
}

/** The short texts the bot sends around a ticket. Designed messages (panel, opening) have their own pages. */
export function TicketMessagesForm({ initial, dmOnClose }: TicketMessagesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveTicketMessages(values), "Messages saved.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Closing message</CardTitle>
        <CardDescription>
          Sent to the opener as a DM when their ticket closes, with the conversation attached as a file.{" "}
          {dmOnClose ? null : (
            <>
              It is turned off right now; switch it on under{" "}
              <Link href="/discord/tickets/settings" className="underline">
                General
              </Link>
              .
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="close-dm">Text</Label>
          <Textarea
            id="close-dm"
            value={values.closeDm}
            onChange={(event) => setValues({ ...values, closeDm: event.target.value })}
            rows={6}
            maxLength={TICKET_MESSAGE_MAX}
            disabled={saving}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Discord formatting works. Placeholders:{" "}
            {TICKET_CLOSE_VARIABLES.map((variable, index) => (
              <span key={variable.key}>
                {index > 0 && ", "}
                <code title={variable.label}>[{variable.key}]</code>
              </span>
            ))}
            .
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving || values.closeDm === DEFAULT_TICKET_MESSAGES.closeDm}
            onClick={() => setValues({ ...values, closeDm: DEFAULT_TICKET_MESSAGES.closeDm })}
          >
            Use the default
          </Button>
        </div>
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValues(initial)} />
      </CardContent>
    </Card>
  );
}
