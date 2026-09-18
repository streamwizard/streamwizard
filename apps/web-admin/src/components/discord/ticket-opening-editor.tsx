"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MESSAGE_PRESETS,
  TICKET_OPENING_MAX_EMBEDS,
  TICKET_OPENING_VARIABLES,
  createMessage,
  validateMessage,
  type BuiltMessage,
} from "@repo/discord-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { MessageBuilder, type BuilderTheme } from "@repo/ui/message-builder";
import { saveTicketOpeningMessageAction } from "@/actions/discord-ticket-design";
import { SaveBar } from "./setting-row";
import { toastResult } from "./toast-result";

// It shares one Discord message with the ticket card, whose Claim and Close
// buttons are the only buttons there. So: embeds, and nothing else.
const EMBED_PRESETS = MESSAGE_PRESETS.filter((preset) => preset.draft.type === "embed");
const VALIDATE = {
  maxElements: TICKET_OPENING_MAX_EMBEDS,
  allowedVariables: TICKET_OPENING_VARIABLES.map((variable) => variable.key),
};

interface TicketOpeningEditorProps {
  categoryId: string;
  /** Null when the category has none yet. */
  initial: BuiltMessage | null;
  themes: BuilderTheme[];
  bot: { name: string; avatarUrl?: string | null };
}

/** What a new ticket channel in this category opens with, above the ticket card. */
export function TicketOpeningEditor({ categoryId, initial, themes, bot }: TicketOpeningEditorProps) {
  const router = useRouter();
  const [empty] = useState(() => createMessage([]));
  const start = initial ?? empty;
  const [message, setMessage] = useState(start);
  const [saving, startSave] = useTransition();

  const dirty = JSON.stringify(message) !== JSON.stringify(start);
  const hasContent = message.elements.length > 0;
  const blocked = hasContent ? (validateMessage(message, VALIDATE)[0]?.message ?? null) : null;

  const save = () =>
    startSave(async () => {
      const result = await saveTicketOpeningMessageAction(categoryId, hasContent ? message : null);
      if (toastResult(result, hasContent ? "Opening message saved." : "Opening message removed.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Opening message</CardTitle>
        <CardDescription>
          Greets the member at the top of their new ticket, above the card with their answers. Up to{" "}
          {TICKET_OPENING_MAX_EMBEDS} embeds. Leave it empty and the ticket opens with the card alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MessageBuilder
          value={message}
          onChange={setMessage}
          presets={EMBED_PRESETS}
          variables={TICKET_OPENING_VARIABLES}
          themes={themes}
          themePanel={false}
          emptyText="No opening message. The ticket opens with the card alone."
          bot={bot}
          maxElements={TICKET_OPENING_MAX_EMBEDS}
          disabled={saving}
        />
        {dirty && blocked && <p className="text-sm text-destructive">{blocked}</p>}
        <SaveBar dirty={dirty && !blocked} pending={saving} onSave={save} onReset={() => setMessage(start)} />
      </CardContent>
    </Card>
  );
}
