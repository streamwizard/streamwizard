"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@repo/ui";
import { cn } from "@/lib/utils";
import { emptyDoc, LIMITS, type DraftSection } from "@/lib/cms/draft";
import { ConfirmButton } from "../confirm-button";
import { RichTextEditor } from "./rich-text-editor";

interface SectionListProps {
  sections: DraftSection[];
  /**
   * Takes an update, not a new list: several sections can change in one go
   * (find and replace), and each change has to build on the last.
   */
  onChange: (update: (sections: DraftSection[]) => DraftSection[]) => void;
  /** Word count of each section's text, in order. */
  words: number[];
  /** Ids of the folded sections. */
  folded: string[];
  onFold: (folded: string[]) => void;
}

function SectionCard({
  section,
  index,
  count,
  words,
  folded,
  onFold,
  onChange,
  onMove,
  onRemove,
}: {
  section: DraftSection;
  index: number;
  count: number;
  words: number;
  folded: boolean;
  onFold: () => void;
  onChange: (section: DraftSection) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  return (
    <li className="space-y-3 border-t pt-6" data-section-id={section.id} data-folded={folded || undefined}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:size-8"
          aria-expanded={!folded}
          aria-controls={`${uid}-body`}
          aria-label={folded ? `Unfold section ${index + 1}` : `Fold section ${index + 1}`}
          onClick={onFold}
        >
          <ChevronDown className={cn("transition-transform motion-reduce:transition-none", folded && "-rotate-90")} />
        </Button>
        <span className="w-6 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">{index + 1}.</span>
        <Input
          id={`${uid}-title`}
          value={section.title}
          maxLength={LIMITS.sectionTitle}
          placeholder="Section title (an H2 on the page)"
          aria-label={`Section ${index + 1} title`}
          data-outline-section
          className="h-11 scroll-mt-32 text-lg font-semibold md:text-lg"
          onChange={(event) => onChange({ ...section, title: event.target.value })}
        />
        <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
          {words} {words === 1 ? "word" : "words"}
        </span>
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
      {/* Folded text stays mounted: its editor keeps its undo history and the outline still finds its headings. */}
      <div id={`${uid}-body`} hidden={folded}>
        <RichTextEditor
          initial={section.body}
          onChange={(body) => onChange({ ...section, body })}
          placeholder="Write this step. Use H3 for sub-steps."
          label={`Section ${index + 1} text`}
        />
      </div>
    </li>
  );
}

/** A guide's chapters, in order. Each one is an H2 on the page with its own text. */
export function SectionList({ sections, onChange, words, folded, onFold }: SectionListProps) {
  const update = (section: DraftSection) =>
    onChange((current) => current.map((other) => (other.id === section.id ? section : other)));
  const move = (from: number, to: number) =>
    onChange((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });

  return (
    <div className="space-y-3">
      <ol className="space-y-8">
        {sections.map((section, index) => (
          <SectionCard
            // Ids are made in the browser for new sections, so keys stay stable across saves.
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            words={words[index] ?? 0}
            folded={folded.includes(section.id)}
            onFold={() =>
              onFold(folded.includes(section.id) ? folded.filter((id) => id !== section.id) : [...folded, section.id])
            }
            onChange={update}
            onMove={(to) => move(index, to)}
            onRemove={() => onChange((current) => current.filter((other) => other.id !== section.id))}
          />
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="h-11 md:h-9"
        disabled={sections.length >= LIMITS.sections}
        onClick={() => {
          const added = { id: crypto.randomUUID(), title: "", body: emptyDoc() };
          onChange((current) => [...current, added]);
        }}
      >
        <Plus aria-hidden />
        Add section
      </Button>
    </div>
  );
}
