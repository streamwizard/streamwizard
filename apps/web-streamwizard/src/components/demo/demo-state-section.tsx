"use client";

import { useState } from "react";
import { RotateCcw, Undo2, X } from "lucide-react";
import { Button, Input, Switch, Textarea } from "@repo/ui";
import { LABEL_CATALOG } from "@repo/schemas";
import {
  GOAL_WIDGET_LABELS,
  GOAL_WIDGET_TYPES,
  editableLabelParts,
  type EditorGoalValue,
  type EditorLabelValue,
} from "@repo/ui/overlay";
import { SectionNote } from "./demo-sections";
import {
  EMPTY_EDITOR_STATE,
  USER_STATE_KEY_PATTERN,
  isEditorStateEmpty,
  useEditorStateData,
  type EditorStateData,
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

/** A number input that commits on blur. Empty means "use the real number". */
function NumberField({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
}) {
  return (
    <CommitInput
      {...props}
      inputMode="decimal"
      value={value === undefined ? "" : String(value)}
      onCommit={(text) => {
        const n = Number(text.trim());
        onCommit(text.trim() === "" || !Number.isFinite(n) ? undefined : n);
      }}
    />
  );
}

function ClearButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="size-7 shrink-0"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Use the real value for ${label}`}
      title="Use the real value"
    >
      <X className="size-3.5" />
    </Button>
  );
}

function GroupTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="text-[11px] font-medium">
      {children} {hint && <span className="font-mono font-normal text-muted-foreground">{hint}</span>}
    </p>
  );
}

/** Built-in widgets: stream labels and goals, shown on the editor canvas only. */
function NativeValueFields({
  data,
  update,
  labelIds,
  goalTypes,
}: {
  data: EditorStateData;
  update: (fn: (d: EditorStateData) => EditorStateData) => void;
  labelIds: string[];
  goalTypes: string[];
}) {
  const labels = LABEL_CATALOG.flatMap((def) => {
    const parts = editableLabelParts(def);
    return parts && labelIds.includes(def.id) ? [{ def, parts }] : [];
  });
  const goals = GOAL_WIDGET_TYPES.filter((type) => goalTypes.includes(type));

  function setLabel(id: string, patch: EditorLabelValue) {
    update((d) => {
      const next = { ...d.labels[id], ...patch };
      const labels = { ...d.labels };
      if (next.name === undefined && next.amount === undefined) delete labels[id];
      else labels[id] = next;
      return { ...d, labels };
    });
  }

  function setGoal(type: string, patch: EditorGoalValue) {
    update((d) => {
      const next = { ...d.goals[type], ...patch };
      const goals = { ...d.goals };
      if (next.current === undefined && next.target === undefined) delete goals[type];
      else goals[type] = next;
      return { ...d, goals };
    });
  }

  return (
    <>
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <GroupTitle>Stream labels</GroupTitle>
          {labels.map(({ def, parts }) => {
            const value = data.labels[def.id];
            return (
              <div key={def.id} className="flex items-center gap-1.5">
                <span className="w-36 shrink-0 truncate text-[11px]">{def.title}</span>
                {parts.name && (
                  <CommitInput
                    value={value?.name ?? ""}
                    onCommit={(text) => setLabel(def.id, { name: text.trim() === "" ? undefined : text })}
                    placeholder="Real name"
                    aria-label={`${def.title}: name`}
                    className="h-7 flex-1 text-[11px]"
                  />
                )}
                {parts.amount && (
                  <NumberField
                    value={value?.amount}
                    onCommit={(amount) => setLabel(def.id, { amount })}
                    placeholder={parts.name ? "Amount" : "Real number"}
                    aria-label={`${def.title}: amount`}
                    className={parts.name ? "h-7 w-24 shrink-0 text-[11px]" : "h-7 flex-1 text-[11px]"}
                  />
                )}
                <ClearButton label={def.title} disabled={!value} onClick={() => setLabel(def.id, { name: undefined, amount: undefined })} />
              </div>
            );
          })}
        </div>
      )}

      {goals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <GroupTitle>Goals</GroupTitle>
          {goals.map((type) => {
            const value = data.goals[type];
            const title = GOAL_WIDGET_LABELS[type].title;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-36 shrink-0 truncate text-[11px]">{title}</span>
                <NumberField
                  value={value?.current}
                  onCommit={(current) => setGoal(type, { current })}
                  placeholder="Real now"
                  aria-label={`${title}: current`}
                  className="h-7 flex-1 text-[11px]"
                />
                <span className="text-[11px] text-muted-foreground">of</span>
                <NumberField
                  value={value?.target}
                  onCommit={(target) => setGoal(type, { target })}
                  placeholder="Real target"
                  aria-label={`${title}: target`}
                  className="h-7 flex-1 text-[11px]"
                />
                <ClearButton label={title} disabled={!value} onClick={() => setGoal(type, { current: undefined, target: undefined })} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Custom widgets: StreamWizard.userState and each widget's own StreamWizard.state. */
function CustomStateFields({
  data,
  update,
  widgets,
}: {
  data: EditorStateData;
  update: (fn: (d: EditorStateData) => EditorStateData) => void;
  widgets: { id: string; label: string }[];
}) {
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
    <>
      <div className="flex flex-col gap-1.5">
        <GroupTitle hint="StreamWizard.userState">Channel values</GroupTitle>
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
    </>
  );
}

/**
 * Values to preview with, editor only. Custom widgets read the real
 * StreamWizard.state and userState, but their writes stop here, so a test
 * counter never touches the one on stream. Stream labels and goals take typed
 * values on top of the real ones. Everything here wins over the real values
 * until "Use real values again", and OBS never sees any of it.
 */
export function SavedDataSection({
  storageId,
  widgets,
  customState = true,
  native,
}: {
  storageId: string;
  /** The custom widgets that can hold their own state, by item id. */
  widgets: { id: string; label: string }[];
  /** Show the custom widget fields: a widget here uses StreamWizard.state or userState. */
  customState?: boolean;
  /** The overlay editor's built-in widgets: label ids and goal widget types on the canvas. */
  native?: { labelIds: string[]; goalTypes: string[] };
}) {
  const [data, update] = useEditorStateData(storageId);
  const [showAll, setShowAll] = useState(false);
  const labelIds = showAll ? LABEL_CATALOG.map((d) => d.id) : (native?.labelIds ?? []);
  const goalTypes = showAll ? [...GOAL_WIDGET_TYPES] : (native?.goalTypes ?? []);

  return (
    <div className="flex flex-col gap-3">
      <SectionNote>
        {native
          ? "Try values on the canvas without waiting for them on stream. Only this editor sees them, never OBS."
          : "Widgets read your real saved values here. Anything they save while you test stays in the editor, so your real counters don't move."}
      </SectionNote>

      {native && (
        <>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Switch checked={showAll} onCheckedChange={setShowAll} className="scale-75" />
            Show every label and goal, not just the ones on this canvas
          </label>
          <NativeValueFields data={data} update={update} labelIds={labelIds} goalTypes={goalTypes} />
        </>
      )}

      {customState && <CustomStateFields data={data} update={update} widgets={widgets} />}

      <div>
        <Button
          size="sm"
          variant="ghost"
          className={quick}
          disabled={isEditorStateEmpty(data)}
          onClick={() => update(() => EMPTY_EDITOR_STATE)}
        >
          <RotateCcw className="size-3" aria-hidden />
          Use real values again
        </Button>
      </div>
    </div>
  );
}
