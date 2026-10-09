"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  ALERT_TEMPLATE_TOKENS,
  alertTokensForEvent,
  type AlertEventType,
} from "@repo/ui/overlay";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { alertTokenMeaning } from "./alert-widget-labels";
import { insertToken } from "./alert-token-insert";

export interface AlertTokenChipsProps {
  event: AlertEventType;
  text: string;
  /** The field these chips type into. */
  inputRef: RefObject<HTMLInputElement | null>;
  maxLength: number;
  /** Same path as typing, so a chip lands in the typing undo step. */
  onChange: (next: string) => void;
}

/** Mouse-down on a chip must not steal focus from the field, or the caret is lost. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

/**
 * One chip per token this alert can fill. A click drops the token at the caret
 * (or over the selection) and leaves the caret after it, so chips and typing
 * mix. What each one prints is on hover, not in a sentence under the field.
 */
export function AlertTokenChips({ event, text, inputRef, maxLength, onChange }: AlertTokenChipsProps) {
  const available = alertTokensForEvent(event);
  // The field is controlled: its value lands on the next commit, and only then
  // can the caret move behind the token.
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(caret, caret);
  }, [text, inputRef]);

  const insert = (token: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const res = insertToken(text, token, start, end, maxLength);
    if (res.text === text) return;
    pendingCaret.current = res.caret;
    onChange(res.text);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {ALERT_TEMPLATE_TOKENS.filter((token) => available.has(token)).map((token) => {
        const meaning = alertTokenMeaning(event, token);
        return (
          <Tooltip key={token}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="font-mono font-normal text-muted-foreground hover:text-foreground"
                aria-label={`Insert {${token}}. ${meaning}`}
                onMouseDown={keepFocus}
                onClick={() => insert(token)}
              >
                {`{${token}}`}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{meaning}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
