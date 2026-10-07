"use client";

import { ImageIcon } from "lucide-react";
import { cn, Label, ToggleGroup, ToggleGroupItem } from "@repo/ui";
import type { AlertLayout } from "@repo/ui/overlay";
import { LAYOUT_OPTIONS } from "./alert-widget-labels";

const MEDIA = "flex shrink-0 items-center justify-center rounded-sm bg-muted-foreground/25 text-muted-foreground";
const TITLE_LINE = "h-1 rounded-full bg-foreground/70";
const SECOND_LINE = "h-1 rounded-full bg-muted-foreground/60";

/** The alert in miniature: a block for the media, two lines for the text. */
function LayoutSketch({ layout }: { layout: AlertLayout }) {
  const lines = (align: "center" | "start") => (
    <div className={cn("flex flex-col gap-1", align === "center" ? "items-center" : "items-start")}>
      <div className={cn(TITLE_LINE, "w-7")} />
      <div className={cn(SECOND_LINE, "w-4")} />
    </div>
  );

  if (layout === "row") {
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn(MEDIA, "size-6")}>
          <ImageIcon className="size-3.5" />
        </div>
        {lines("start")}
      </div>
    );
  }

  if (layout === "overlay") {
    return (
      <div className={cn(MEDIA, "relative h-10 w-14")}>
        <ImageIcon className="size-6 opacity-40" />
        <div className="absolute inset-0 flex items-center justify-center">{lines("center")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(MEDIA, "h-5 w-8")}>
        <ImageIcon className="size-3.5" />
      </div>
      {lines("center")}
    </div>
  );
}

/**
 * Where the image or video sits against the text, picked from a sketch of each
 * arrangement: the shape answers the question before the label is read.
 */
export function AlertLayoutPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: AlertLayout;
  onChange: (layout: AlertLayout) => void;
}) {
  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} className="text-xs">
        Where it sits
      </Label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as AlertLayout)}
        spacing={2}
        aria-labelledby={`${id}-label`}
        className="grid w-full grid-cols-3"
      >
        {LAYOUT_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-auto w-full flex-col items-stretch gap-2 border border-input p-2 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
          >
            <div className="flex h-11 items-center justify-center">
              <LayoutSketch layout={option.value} />
            </div>
            <span className="text-center">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
