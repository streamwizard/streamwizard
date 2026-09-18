"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from "@repo/ui";
import { SortableList } from "@repo/ui/components/sortable-list";
import { saveTicketCategoryFormAction } from "@/actions/discord-ticket-design";
import { SaveBar } from "./setting-row";
import { toastResult } from "./toast-result";

type FieldKind = "subject" | "description" | "product" | "text" | "select";

interface OptionDraft {
  label: string;
  value: string;
  description: string;
  emoji: string;
}

/** A question as the editor holds it. `id` is the database id, or "new-…" until the first save. */
export interface TicketFieldDraft {
  id: string;
  kind: FieldKind;
  label: string;
  placeholder: string;
  style: "short" | "paragraph";
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  options: OptionDraft[];
}

interface Limits {
  maxFields: number;
  labelMax: number;
  placeholderMax: number;
  textMax: number;
  subjectMax: number;
  maxOptions: number;
  optionMax: number;
}

interface TicketFormEditorProps {
  categoryId: string;
  initial: TicketFieldDraft[];
  /** Without products the product question is skipped in Discord; the editor says so. */
  hasProducts: boolean;
  limits: Limits;
}

const KINDS: Record<FieldKind, { name: string; hint: string; once: boolean }> = {
  subject: { name: "Subject", hint: "A short line. Becomes the ticket's title.", once: true },
  description: { name: "Description", hint: "The long answer. Shown at the top of the ticket.", once: true },
  product: { name: "Product", hint: "A dropdown of your products. Filters the ticket list.", once: true },
  text: { name: "Text question", hint: "Anything else you want to ask.", once: false },
  select: { name: "Dropdown question", hint: "Pick one from options you write.", once: false },
};

const isNew = (id: string) => id.startsWith("new-");

const blank = (kind: FieldKind): TicketFieldDraft => ({
  id: `new-${crypto.randomUUID()}`,
  kind,
  label: kind === "text" || kind === "select" ? "" : KINDS[kind].name,
  placeholder: "",
  style: kind === "description" ? "paragraph" : "short",
  required: true,
  minLength: null,
  maxLength: null,
  options: [],
});

/** "Windows 11" gives "windows_11". Values are what is stored on the question, labels what people read. */
const optionValue = (label: string, taken: string[]): string => {
  const base =
    label
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "option";
  let value = base;
  for (let n = 2; taken.includes(value); n++) value = `${base}_${n}`;
  return value;
};

/** The questions a category's ticket form asks, in order. Saved as a whole. */
export function TicketFormEditor({ categoryId, initial, hasProducts, limits }: TicketFormEditorProps) {
  const router = useRouter();
  const [fields, setFields] = useState(initial);
  const [editing, setEditing] = useState<TicketFieldDraft | null>(null);
  const [saving, startSave] = useTransition();

  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);
  const full = fields.length >= limits.maxFields;
  const addable = (Object.keys(KINDS) as FieldKind[]).filter(
    (kind) => !KINDS[kind].once || !fields.some((field) => field.kind === kind),
  );

  const save = () =>
    startSave(async () => {
      const result = await saveTicketCategoryFormAction(
        categoryId,
        fields.map((field) => ({
          ...(isNew(field.id) ? {} : { id: field.id }),
          kind: field.kind,
          label: field.label,
          placeholder: field.placeholder,
          style: field.style,
          required: field.required,
          minLength: field.minLength,
          maxLength: field.maxLength,
          options: field.options.map((o) => ({
            label: o.label,
            value: o.value,
            ...(o.description ? { description: o.description } : {}),
            emoji: o.emoji || null,
          })),
        })),
      );
      if (toastResult(result, "Form saved.")) router.refresh();
    });

  const upsert = (next: TicketFieldDraft) => {
    setFields((current) =>
      current.some((field) => field.id === next.id)
        ? current.map((field) => (field.id === next.id ? next : field))
        : [...current, next],
    );
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Form</CardTitle>
          <CardDescription>
            What members fill in to open a ticket here. Discord fits {limits.maxFields} questions in a form. With none,
            the ticket opens straight away.
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={saving || full} title={full ? `Discord fits ${limits.maxFields} questions` : undefined}>
              <Plus />
              Add question
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {addable.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => setEditing(blank(kind))} className="flex-col items-start gap-0.5">
                <span className="font-medium">{KINDS[kind].name}</span>
                <span className="text-xs text-muted-foreground">{KINDS[kind].hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions. Tickets in this category open without a form, filed under the category&apos;s name.
          </p>
        ) : (
          <SortableList
            id={`ticket-form-${categoryId}`}
            items={fields}
            onReorder={setFields}
            disabled={saving}
            itemLabel={(field) => field.label || KINDS[field.kind].name}
          >
            {(field) => (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{field.label || "Untitled question"}</span>
                    {/* "Subject · Subject" says nothing; the badge earns its place once the label differs. */}
                    {field.label !== KINDS[field.kind].name && <Badge variant="outline">{KINDS[field.kind].name}</Badge>}
                    {!field.required && <Badge variant="outline">Optional</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {field.kind === "product" && !hasProducts
                      ? "Skipped in Discord until you add a product."
                      : field.kind === "select"
                        ? field.options.map((o) => o.label).join(", ") || "No options yet"
                        : field.placeholder || KINDS[field.kind].hint}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${field.label || "question"}`}
                  title="Edit"
                  disabled={saving}
                  onClick={() => setEditing(field)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${field.label || "question"}`}
                  title="Remove"
                  disabled={saving}
                  onClick={() => setFields((current) => current.filter((f) => f.id !== field.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </SortableList>
        )}
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setFields(initial)} />
      </CardContent>

      {editing && (
        <FieldDialog key={editing.id} field={editing} limits={limits} onClose={() => setEditing(null)} onDone={upsert} />
      )}
    </Card>
  );
}

function FieldDialog({
  field,
  limits,
  onClose,
  onDone,
}: {
  field: TicketFieldDraft;
  limits: Limits;
  onClose: () => void;
  onDone: (field: TicketFieldDraft) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(field);
  const set = <K extends keyof TicketFieldDraft>(key: K, value: TicketFieldDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const isText = draft.kind === "subject" || draft.kind === "description" || draft.kind === "text";
  const ceiling = draft.kind === "subject" ? limits.subjectMax : limits.textMax;
  const number = (value: string, max: number): number | null => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, max) : null;
  };

  const setOption = (index: number, patch: Partial<OptionDraft>) =>
    set(
      "options",
      draft.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    );

  const ready =
    draft.label.trim().length > 0 &&
    (draft.kind !== "select" || (draft.options.length > 0 && draft.options.every((o) => o.label.trim())));

  const submit = () => {
    const taken: string[] = [];
    onDone({
      ...draft,
      label: draft.label.trim(),
      placeholder: draft.placeholder.trim(),
      // An option keeps its value once it has one, so old answers still match it.
      options: draft.options.map((o) => {
        const value = o.value || optionValue(o.label, taken);
        taken.push(value);
        return { ...o, label: o.label.trim(), description: o.description.trim(), emoji: o.emoji.trim(), value };
      }),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{KINDS[draft.kind].name}</DialogTitle>
            <DialogDescription>{KINDS[draft.kind].hint}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-label`}>Question</Label>
            <Input
              id={`${id}-label`}
              value={draft.label}
              onChange={(event) => set("label", event.target.value)}
              maxLength={limits.labelMax}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-placeholder`}>Placeholder</Label>
            <Input
              id={`${id}-placeholder`}
              value={draft.placeholder}
              onChange={(event) => set("placeholder", event.target.value)}
              maxLength={limits.placeholderMax}
            />
            <p className="text-xs text-muted-foreground">Grey hint text inside the empty field. Optional.</p>
          </div>

          {draft.kind === "text" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-style`}>Answer size</Label>
              <NativeSelect
                id={`${id}-style`}
                value={draft.style}
                onChange={(event) => set("style", event.target.value === "paragraph" ? "paragraph" : "short")}
              >
                <NativeSelectOption value="short">One line</NativeSelectOption>
                <NativeSelectOption value="paragraph">Paragraph</NativeSelectOption>
              </NativeSelect>
            </div>
          )}

          {isText && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`${id}-min`}>Shortest answer</Label>
                <Input
                  id={`${id}-min`}
                  type="number"
                  min={0}
                  max={ceiling}
                  value={draft.minLength ?? ""}
                  onChange={(event) => set("minLength", number(event.target.value, ceiling))}
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-max`}>Longest answer</Label>
                <Input
                  id={`${id}-max`}
                  type="number"
                  min={1}
                  max={ceiling}
                  value={draft.maxLength ?? ""}
                  onChange={(event) => set("maxLength", number(event.target.value, ceiling) || null)}
                  placeholder={String(ceiling)}
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">In characters. Discord allows {ceiling} here.</p>
            </div>
          )}

          {draft.kind === "select" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Options</legend>
              {draft.options.map((option, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    aria-label={`Option ${index + 1} emoji`}
                    value={option.emoji}
                    onChange={(event) => setOption(index, { emoji: event.target.value })}
                    maxLength={64}
                    placeholder="🙂"
                    className="w-16 shrink-0 text-center"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      aria-label={`Option ${index + 1} label`}
                      value={option.label}
                      onChange={(event) => setOption(index, { label: event.target.value })}
                      maxLength={limits.optionMax}
                      placeholder="Label"
                      required
                    />
                    <Input
                      aria-label={`Option ${index + 1} description`}
                      value={option.description}
                      onChange={(event) => setOption(index, { description: event.target.value })}
                      maxLength={limits.optionMax}
                      placeholder="Description (optional)"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() =>
                      set(
                        "options",
                        draft.options.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.options.length >= limits.maxOptions}
                onClick={() => set("options", [...draft.options, { label: "", value: "", description: "", emoji: "" }])}
              >
                <Plus />
                Add option
              </Button>
            </fieldset>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-required`}>Required</Label>
              <p className="text-xs text-muted-foreground">Off lets members leave it empty.</p>
            </div>
            <Switch id={`${id}-required`} checked={draft.required} onCheckedChange={(value) => set("required", value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              Done
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
