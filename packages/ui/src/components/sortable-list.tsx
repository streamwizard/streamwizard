"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Moves one row a step without dragging, for a "Move up" / "Move down" button
 * or menu item in the row. Undefined where the row can't go: the first row has
 * no `up`, the last no `down`, a disabled list neither.
 */
export interface SortableMove {
  up?: () => void;
  down?: () => void;
}

interface SortableListProps<T extends { id: string }> {
  /**
   * A fixed id for the drag context. dnd-kit otherwise numbers its contexts,
   * and the server and client count differently, which breaks hydration.
   */
  id: string;
  items: T[];
  /** Called with the full list in its new order. */
  onReorder: (items: T[]) => void;
  disabled?: boolean;
  /** "Bug", "Cloud OBS": names the row for screen readers on its drag handle. */
  itemLabel: (item: T) => string;
  /** `move` is opt-in: a row that ignores it is drag-only, as before. */
  children: (item: T, move: SortableMove) => React.ReactNode;
  className?: string;
  /** Extra classes for the drag handle, e.g. to hide it on a phone where the row offers `move` instead. */
  handleClassName?: string;
}

/** A vertical list whose rows can be dragged (or moved with the keyboard) into a new order. */
export function SortableList<T extends { id: string }>({
  id,
  items,
  onReorder,
  disabled,
  itemLabel,
  children,
  className,
  handleClassName,
}: SortableListProps<T>) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the handle isn't one.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn("divide-y", className)}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              label={itemLabel(item)}
              disabled={disabled || items.length < 2}
              handleClassName={handleClassName}
            >
              {children(item, {
                up: disabled || index === 0 ? undefined : () => onReorder(arrayMove(items, index, index - 1)),
                down: disabled || index === items.length - 1 ? undefined : () => onReorder(arrayMove(items, index, index + 1)),
              })}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  handleClassName,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  handleClassName?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-card py-3", isDragging && "relative z-10 shadow-md")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${label}`}
        disabled={disabled}
        className={cn(
          "flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-default disabled:opacity-40",
          handleClassName,
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
