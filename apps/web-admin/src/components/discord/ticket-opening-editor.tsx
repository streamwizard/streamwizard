"use client";

import { useState } from "react";
import {
  MESSAGE_PRESETS,
  TICKET_OPENING_MAX_EMBEDS,
  TICKET_OPENING_VARIABLES,
  createMessage,
  validateMessage,
  type BuiltMessage,
} from "@repo/discord-message";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { DesktopOnly } from "@/components/widgets/desktop-only";
import { MessageBuilder, type BuilderTheme } from "@repo/ui/message-builder";
import { saveTicketOpeningMessageAction } from "@/actions/discord-ticket-design";
import { useCategorySavePart } from "./ticket-category-save";

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

/** What a new ticket channel in this category opens with, above the ticket card. Saved by the category page's save bar. */
export function TicketOpeningEditor({ categoryId, initial, themes, bot }: TicketOpeningEditorProps) {
  const [empty] = useState(() => createMessage([]));
  const start = initial ?? empty;
  const [message, setMessage] = useState(start);

  const dirty = JSON.stringify(message) !== JSON.stringify(start);
  const hasContent = message.elements.length > 0;
  const blocked = hasContent ? (validateMessage(message, VALIDATE)[0]?.message ?? null) : null;

  const saving = useCategorySavePart({
    label: "Opening message",
    saved: hasContent ? "Opening message saved." : "Opening message removed.",
    dirty,
    blocked,
    reset: () => setMessage(start),
    save: () => saveTicketOpeningMessageAction(categoryId, hasContent ? message : null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Opening message
          {dirty && <Badge variant="outline">Not saved</Badge>}
        </CardTitle>
        <CardDescription>
          Greets the member at the top of their new ticket, above the card with their answers. Up to{" "}
          {TICKET_OPENING_MAX_EMBEDS} embeds. Leave it empty and the ticket opens with the card alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DesktopOnly tool="The message builder" bare>
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
        </DesktopOnly>
        {dirty && blocked && <p className="text-sm text-destructive">{blocked}</p>}
      </CardContent>
    </Card>
  );
}
