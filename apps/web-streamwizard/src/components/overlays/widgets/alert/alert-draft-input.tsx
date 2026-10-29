"use client";

import { useState } from "react";
import { Input } from "@repo/ui";

/**
 * A text field that keeps what is being typed to itself. The stored value is
 * cleaned on every read (an empty name gets a default, usernames lose their
 * spaces and capitals), and a field bound straight to it would rewrite the
 * text under the cursor. It shows the stored value again once focus leaves.
 */
export function DraftInput({
  id,
  stored,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  stored: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      value={draft ?? stored}
      maxLength={maxLength}
      placeholder={placeholder}
      className="h-9 text-sm"
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
