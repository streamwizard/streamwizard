"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { MessageIssue } from "@repo/discord-message";
import { cn } from "../../lib/utils";
import { ToolbarButton } from "./toolbar-button";

/** Controls stay out of the way until the element is hovered or focused; touch screens have no hover, so they always show. */
export const REVEAL =
  "opacity-0 transition-opacity group-hover/element:opacity-100 group-focus-within/element:opacity-100 pointer-coarse:opacity-100";

interface ElementShellProps {
  id: string;
  /** "Welcome banner", "Rules embed": names the element for screen readers. */
  name: string;
  issues: MessageIssue[];
  sortable: boolean;
  disabled?: boolean;
  onDelete: () => void;
  children: React.ReactNode;
}

/** What every element gets: drag handle on the left, delete on the right, its problems underneath. */
export function ElementShell({ id, name, issues, sortable, disabled, onDelete, children }: ElementShellProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable || disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/element relative", isDragging && "z-10 opacity-80")}
    >
      {sortable && (
        <ToolbarButton
          ref={setActivatorNodeRef}
          label={`Reorder ${name}`}
          disabled={disabled}
          className={cn("absolute -left-9 top-1 cursor-grab touch-none active:cursor-grabbing", REVEAL)}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </ToolbarButton>
      )}
      {sortable && (
        <ToolbarButton
          label={`Delete ${name}`}
          tone="danger"
          disabled={disabled}
          onClick={onDelete}
          className={cn("absolute -right-9 top-1", REVEAL)}
        >
          <Trash2 />
        </ToolbarButton>
      )}
      <div className={cn("rounded-[4px]", issues.length > 0 && "outline outline-2 outline-offset-2 outline-[#f23f43]")}>{children}</div>
      {issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs text-[#ffb3b5]" aria-live="polite">
          {issues.map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
