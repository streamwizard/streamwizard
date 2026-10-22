"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@repo/ui";
import { SortableList, type SortableMove } from "@repo/ui/components/sortable-list";
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
  move,
  onChange,
  onRemove,
}: {
  section: DraftSection;
  index: number;
  /** Drag does the same thing; these keep it reachable from the keyboard. */
  move: SortableMove;
  onChange: (section: DraftSection) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  return (
    <div className="space-y-3 rounded-lg border p-4">
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
          disabled={!move.up}
          onClick={move.up}
          aria-label={`Move section ${index + 1} up`}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          disabled={!move.down}
          onClick={move.down}
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
    </div>
  );
}

/** A guide's chapters, in order. Each one is an H2 on the page with its own text. */
export function SectionList({ sections, onChange }: SectionListProps) {
  const update = (index: number, section: DraftSection) =>
    onChange(sections.map((current, i) => (i === index ? section : current)));

  return (
    <div className="space-y-3">
      <SortableList
        id="guide-sections"
        items={sections}
        onReorder={onChange}
        itemLabel={(section) => section.title.trim() || "this section"}
        className="space-y-4 divide-y-0"
        handleClassName="self-start"
      >
        {(section, move) => (
          <SectionCard
            section={section}
            index={sections.findIndex((current) => current.id === section.id)}
            move={move}
            onChange={(next) => update(sections.indexOf(section), next)}
            onRemove={() => onChange(sections.filter((current) => current.id !== section.id))}
          />
        )}
      </SortableList>
      <Button
        type="button"
        variant="outline"
        className="h-11 md:h-9"
        disabled={sections.length >= LIMITS.sections}
        onClick={() => onChange([...sections, { id: crypto.randomUUID(), title: "", anchor: null, body: emptyDoc() }])}
      >
        <Plus aria-hidden />
        Add section
      </Button>
    </div>
  );
}
