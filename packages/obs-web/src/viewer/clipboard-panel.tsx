"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Textarea } from "@repo/ui";
import { CLIPBOARD_TEXT_LIMIT } from "./relay-protocol";
import type { ClipboardFromObs } from "./use-viewer-frame";

// Manual clipboard, for browsers where Selkies' automatic sync can't run
// (Firefox has no page readText, Safari wants a gesture per read). A native
// paste into the textarea is itself the gesture.

const SEND_DELAY_MS = 300;

export function ClipboardPanel({
  fromObs,
  onSend,
}: {
  fromObs: ClipboardFromObs | null;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text copied inside OBS replaces the draft.
  useEffect(() => {
    if (fromObs && !fromObs.secret) setDraft(fromObs.text);
  }, [fromObs]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // A cut-down copy must not be sent back over the full text in OBS.
  const readOnly = fromObs?.truncated === true && draft === fromObs.text;

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value.slice(0, CLIPBOARD_TEXT_LIMIT);
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSend(text), SEND_DELAY_MS);
  };

  return (
    <div className="w-80 rounded-md border border-white/10 bg-black/90 p-3 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-white">Clipboard</p>
      <p className="mt-1 text-xs text-white/50">
        Paste here to send text to OBS. Anything you copy in OBS shows up here too.
      </p>
      <Textarea
        value={draft}
        onChange={onChange}
        readOnly={readOnly}
        rows={5}
        spellCheck={false}
        aria-label="Clipboard text"
        className="mt-2 max-h-60 border-white/10 bg-white/5 text-xs text-white"
      />
      {readOnly && (
        <p className="mt-1.5 text-xs text-white/50">Too long to show in full, so it&apos;s read-only here.</p>
      )}
      {fromObs?.secret && (
        <p className="mt-1.5 text-xs text-white/50">OBS copied something marked secret. It isn&apos;t shown here.</p>
      )}
    </div>
  );
}
