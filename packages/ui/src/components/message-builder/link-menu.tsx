"use client";

import { useId, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { normalizeUrl } from "./links";
import { ToolbarButton } from "./toolbar-button";

export interface LinkDraft {
  label: string;
  url: string;
  /** The caret was in a link already: the menu edits it and offers to remove it. */
  existing: boolean;
}

interface LinkMenuProps {
  /** What the menu opens with: the selected words, or the link under the caret. Null keeps it closed. */
  draft: LinkDraft | null;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (label: string, url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

/** Links without the [text](address) syntax: two boxes, and the builder writes it. */
export function LinkMenu({ draft, onOpen, onClose, onSubmit, onRemove, disabled }: LinkMenuProps) {
  return (
    <Popover open={draft !== null} onOpenChange={(open) => (open ? onOpen() : onClose())}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Add a link (Ctrl+K)" disabled={disabled}>
          <Link2 />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 p-3">
        {draft && <LinkForm initial={draft} onSubmit={onSubmit} onRemove={onRemove} />}
      </PopoverContent>
    </Popover>
  );
}

function LinkForm({
  initial,
  onSubmit,
  onRemove,
}: {
  initial: LinkDraft;
  onSubmit: (label: string, url: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(initial.label);
  const [url, setUrl] = useState(initial.url);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const address = normalizeUrl(url);
        if (!address) return setError("Enter a web address, like https://twitch.tv/your-channel.");
        onSubmit(label, address);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-label`} className="text-xs">
          Text
        </Label>
        <Input
          id={`${id}-label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Twitch"
          autoFocus={!initial.label}
          className="h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-url`} className="text-xs">
          Link
        </Label>
        <Input
          id={`${id}-url`}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://twitch.tv/your-channel"
          inputMode="url"
          spellCheck={false}
          autoFocus={Boolean(initial.label)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8"
        />
        {error && (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {initial.existing ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove link
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm">
          {initial.existing ? "Update link" : "Add link"}
        </Button>
      </div>
    </form>
  );
}
