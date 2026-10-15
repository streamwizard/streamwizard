"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@repo/ui";
import { emptyDoc, LIMITS, type DraftSection } from "@/lib/cms/draft";
import { ConfirmButton } from "../confirm-button";
import { RichTextEditor } from "./rich-text-editor";

interface SectionListProps {
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
}

function SectionCard({
  section,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  section: DraftSection;
  index: number;
  count: number;
  onChange: (section: DraftSection) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground tabular-nums">{index + 1}.</span>
        <Input
          id={`${uid}-title`}
          value={section.title}
          maxLength={LIMITS.sectionTitle}
          placeholder="Section title (an H2 on the page)"
          aria-label={`Section ${index + 1} title`}
          className="font-medium"
          onChange={(event) => onChange({ ...section, title: event.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
          aria-label={`Move section ${index + 1} up`}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
          aria-label={`Move section ${index + 1} down`}
        >
          <ArrowDown />
        </Button>
        <ConfirmButton
          title={`Remove section ${index + 1}?`}
          description="Its text goes with it. You can get it back from Revisions."
          confirmLabel="Remove"
          onConfirm={onRemove}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            aria-label={`Remove section ${index + 1}`}
          >
            <Trash2 />
          </Button>
        </ConfirmButton>
      </div>
      <RichTextEditor
        initial={section.body}
        onChange={(body) => onChange({ ...section, body })}
        placeholder="Write this step. Use H3 for sub-steps."
        label={`Section ${index + 1} text`}
      />
    </li>
  );
}

/** A guide's chapters, in order. Each one is an H2 on the page with its own text. */
export function SectionList({ sections, onChange }: SectionListProps) {
  const update = (index: number, section: DraftSection) =>
    onChange(sections.map((current, i) => (i === index ? section : current)));
  const move = (from: number, to: number) => {
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-4">
        {sections.map((section, index) => (
          <SectionCard
            // Ids are made in the browser for new sections, so keys stay stable across saves.
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            onChange={(next) => update(index, next)}
            onMove={(to) => move(index, to)}
            onRemove={() => onChange(sections.filter((_, i) => i !== index))}
          />
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="h-11 md:h-9"
        disabled={sections.length >= LIMITS.sections}
        onClick={() => onChange([...sections, { id: crypto.randomUUID(), title: "", body: emptyDoc() }])}
      >
        <Plus aria-hidden />
        Add section
      </Button>
    </div>
  );
}
