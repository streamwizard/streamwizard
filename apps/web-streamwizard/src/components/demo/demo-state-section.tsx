"use client";

import { useState } from "react";
import { RotateCcw, Undo2, X } from "lucide-react";
import { Button, Input, Textarea } from "@repo/ui";
import { SectionNote } from "./demo-sections";
import {
  USER_STATE_KEY_PATTERN,
  isEditorStateEmpty,
  useEditorStateData,
} from "./editor-state-data";

const quick = "h-7 px-2.5 text-xs";

/** Typed text as a value: JSON where it parses, so 42 is a number, and plain text otherwise. */
function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function showValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** An input that keeps what you type until you leave it, then commits. */
function CommitInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // A new value from outside (the widget wrote one) replaces the draft.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** One placed widget's own StreamWizard.state, as JSON. Empty means "use the real one". */
function WidgetStateBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown> | undefined;
  onChange: (value: Record<string, unknown> | undefined) => void;
}) {
  const shown = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setDraft(shown);
    setError(null);
  }

  function commit() {
    if (draft === shown) return;
    if (draft.trim() === "") {
      onChange(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(draft);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError("Widget data has to be an object, like {\"best\": 10}.");
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch {
      setError("That isn't valid JSON yet.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium">
        {label} <span className="font-mono font-normal text-muted-foreground">StreamWizard.state</span>
      </p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={3}
        spellCheck={false}
        placeholder="Empty: the widget reads its real saved data."
        aria-label={`StreamWizard.state for ${label} (JSON)`}
        aria-invalid={error ? true : undefined}
        className="max-h-40 font-mono text-[11px] leading-relaxed"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/**
 * What custom widgets have saved while you test. In the editor they read the
 * real StreamWizard.state and userState, but their writes stop here, so a
 * test counter never touches the one on stream. Values typed here win over
 * the real ones until "Use real values again".
 */
export function SavedDataSection({
  storageId,
  widgets,
}: {
  storageId: string;
  /** The custom widgets that can hold their own state, by item id. */
  widgets: { id: string; label: string }[];
}) {
  const [data, update] = useEditorStateData(storageId);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const keyError =
    newKey !== "" && !USER_STATE_KEY_PATTERN.test(newKey)
      ? "Keys are lowercase letters, numbers and _ (up to 64)."
      : null;

  const entries = Object.entries(data.userState).sort(([a], [b]) => a.localeCompare(b));

  function setUserValue(key: string, value: unknown) {
    update((d) => ({ ...d, userState: { ...d.userState, [key]: value } }));
  }

  function dropUserValue(key: string) {
    update((d) => {
      const userState = { ...d.userState };
      delete userState[key];
      return { ...d, userState };
    });
  }

  function addUserValue() {
    if (!newKey || keyError) return;
    setUserValue(newKey, parseValue(newValue));
    setNewKey("");
    setNewValue("");
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionNote>
        Widgets read your real saved values here. Anything they save while you test stays in the editor, so your
        real counters don&apos;t move.
      </SectionNote>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium">
          Channel values <span className="font-mono font-normal text-muted-foreground">StreamWizard.userState</span>
        </p>
        {entries.length === 0 && (
          <SectionNote>Nothing changed yet. The widgets see your real values.</SectionNote>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <code className="w-36 shrink-0 truncate text-[11px]" title={key}>
              {key}
            </code>
            {value === null ? (
              <p className="flex-1 text-[11px] italic text-muted-foreground">Deleted while testing</p>
            ) : (
              <CommitInput
                value={showValue(value)}
                onCommit={(text) => setUserValue(key, parseValue(text))}
                aria-label={`Value for ${key}`}
                className="h-7 flex-1 font-mono text-[11px]"
              />
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7 shrink-0"
              onClick={() => dropUserValue(key)}
              aria-label={`Use the real value for ${key}`}
              title="Use the real value"
            >
              {value === null ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
            </Button>
          </div>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            addUserValue();
          }}
        >
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.trim())}
            placeholder="key"
            aria-label="New key"
            aria-invalid={keyError ? true : undefined}
            className="h-7 w-36 shrink-0 font-mono text-[11px]"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder='Value, like 42 or "hi chat"'
            aria-label="New value"
            className="h-7 flex-1 font-mono text-[11px]"
          />
          <Button type="submit" size="sm" variant="outline" className={quick} disabled={!newKey || !!keyError}>
            Add
          </Button>
        </form>
        {keyError && <p className="text-[11px] text-destructive">{keyError}</p>}
      </div>

      {widgets.map((w) => (
        <WidgetStateBox
          key={w.id}
          label={w.label}
          value={data.widgetState[w.id]}
          onChange={(value) =>
            update((d) => {
              const widgetState = { ...d.widgetState };
              if (value === undefined) delete widgetState[w.id];
              else widgetState[w.id] = value;
              return { ...d, widgetState };
            })
          }
        />
      ))}

      <div>
        <Button
          size="sm"
          variant="ghost"
          className={quick}
          disabled={isEditorStateEmpty(data)}
          onClick={() => update(() => ({ userState: {}, widgetState: {} }))}
        >
          <RotateCcw className="size-3" aria-hidden />
          Use real values again
        </Button>
      </div>
    </div>
  );
}
