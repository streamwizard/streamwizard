"use client";

import { useId, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical, Rows2, X } from "lucide-react";
import { dropField, fieldRows, type EmbedField, type FieldDropSide } from "@repo/discord-message";
import { cn } from "../../lib/utils";

// Fields are arranged by dragging. Drop one on the left or right edge of
// another and the two share a row; drop it on the top or bottom half and it
// gets a row of its own. Widths follow from how many share a row, as in
// Discord. This drag context sits inside the one that reorders whole elements.

interface Drop {
  targetId: string;
  side: FieldDropSide;
}

/** How far in from the left or right edge still counts as "beside". */
const BESIDE = 0.3;

const distanceTo = (rect: ClientRect, x: number, y: number) =>
  Math.hypot(Math.max(rect.left - x, 0, x - rect.right), Math.max(rect.top - y, 0, y - rect.bottom));

function sideOf(rect: ClientRect, x: number, y: number): FieldDropSide {
  const across = (x - rect.left) / rect.width;
  if (across < BESIDE) return "left";
  if (across > 1 - BESIDE) return "right";
  return y < rect.top + rect.height / 2 ? "above" : "below";
}

/**
 * The field under the pointer, or the nearest one, with the side of it the
 * pointer is on. A keyboard drag has no pointer: the middle of the moved field
 * stands in. Nothing while still over the field's own spot, so letting go
 * there changes nothing.
 */
const fieldCollision: CollisionDetection = ({ active, collisionRect, droppableRects, droppableContainers, pointerCoordinates }) => {
  const x = pointerCoordinates?.x ?? collisionRect.left + collisionRect.width / 2;
  const y = pointerCoordinates?.y ?? collisionRect.top + collisionRect.height / 2;

  const home = droppableRects.get(active.id);
  if (home && distanceTo(home, x, y) === 0) return [];

  let best: { id: string | number; rect: ClientRect; distance: number } | null = null;
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id);
    if (!rect || container.id === active.id) continue;
    const distance = distanceTo(rect, x, y);
    if (!best || distance < best.distance) best = { id: container.id, rect, distance };
  }
  if (!best) return [];
  const match = droppableContainers.find((container) => container.id === best.id);
  return [{ id: best.id, data: { droppableContainer: match, value: best.distance, side: sideOf(best.rect, x, y) } }];
};

function dropOf(event: DragMoveEvent | DragEndEvent): Drop | null {
  const hit = event.collisions?.[0];
  const side = hit?.data?.side as FieldDropSide | undefined;
  return hit && side ? { targetId: String(hit.id), side } : null;
}

// Twelve columns, as Discord has: one field fills the row, two halve it, three take a third each.
const SPAN: Record<number, string> = { 1: "sm:col-span-12", 2: "sm:col-span-6", 3: "sm:col-span-4" };

interface EmbedFieldsProps {
  fields: EmbedField[];
  disabled?: boolean;
  onChange: (fields: EmbedField[]) => void;
  /** The field's name and value. The controls around them are added here. */
  children: (field: EmbedField) => React.ReactNode;
}

export function EmbedFields({ fields, disabled, onChange, children }: EmbedFieldsProps) {
  // Without a fixed id dnd-kit numbers its aria-describedby per render, which differs between server and client.
  const dndId = useId();
  const sensors = useSensors(
    // A few pixels of slack, so a click on the handle isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [drop, setDrop] = useState<Drop | null>(null);

  const rows = fieldRows(fields);
  // Above and below apply to the whole row, so the whole row shows the line.
  const dropRow = drop && (drop.side === "above" || drop.side === "below") ? rows.find((row) => row.some((f) => f.id === drop.targetId)) : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={fieldCollision}
      onDragMove={(event) => {
        const next = dropOf(event);
        setDrop((current) => (current?.targetId === next?.targetId && current?.side === next?.side ? current : next));
      }}
      onDragEnd={(event) => {
        const landed = dropOf(event);
        setDrop(null);
        if (landed) onChange(dropField(fields, String(event.active.id), landed.targetId, landed.side));
      }}
      onDragCancel={() => setDrop(null)}
    >
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-12">
        {rows.map((row) =>
          row.map((field) => (
            <FieldShell
              key={field.id}
              field={field}
              span={SPAN[row.length] ?? "sm:col-span-12"}
              draggable={fields.length > 1}
              disabled={disabled}
              marker={drop?.targetId === field.id ? drop.side : dropRow?.includes(field) ? drop!.side : null}
              onToggleInline={() => onChange(fields.map((f) => (f.id === field.id ? { ...f, inline: !f.inline } : f)))}
              onRemove={() => onChange(fields.filter((f) => f.id !== field.id))}
            >
              {children(field)}
            </FieldShell>
          )),
        )}
      </div>
    </DndContext>
  );
}

// The line that shows where the field lands. It reaches into the gap, so the lines of a row join up.
const MARKER: Record<FieldDropSide, string> = {
  left: "-left-2 top-0 bottom-0 w-0.5",
  right: "-right-2 top-0 bottom-0 w-0.5",
  above: "-top-1 -left-2 -right-2 h-0.5",
  below: "-bottom-1 -left-2 -right-2 h-0.5",
};

const FIELD_BUTTON = "rounded p-0.5 text-[#949ba4] hover:text-white";

interface FieldShellProps {
  field: EmbedField;
  span: string;
  /** One field has nowhere to go. */
  draggable: boolean;
  disabled?: boolean;
  marker: FieldDropSide | null;
  onToggleInline: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

/** A field with its hover controls: drag to arrange, own row or side by side, remove. */
function FieldShell({ field, span, draggable, disabled, marker, onToggleInline, onRemove, children }: FieldShellProps) {
  const off = !draggable || disabled;
  const { attributes, listeners, setNodeRef: setDragRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: field.id, disabled: off });
  const { setNodeRef: setDropRef } = useDroppable({ id: field.id, disabled: off });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group/field relative min-w-0 rounded-sm",
        span,
        isDragging && "pointer-events-none z-10 bg-[#2b2d31] opacity-80 ring-1 ring-[#5865f2]",
      )}
    >
      {children}
      {marker && <span aria-hidden className={cn("pointer-events-none absolute rounded-full bg-[#5865f2]", MARKER[marker])} />}
      <div className="absolute right-0 top-0.5 flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover/field:opacity-100 pointer-coarse:opacity-100">
        {draggable && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="Move field"
            title="Drag beside another field to share a row, above or below for a row of its own"
            disabled={disabled}
            className={cn(FIELD_BUTTON, "cursor-grab touch-none active:cursor-grabbing")}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={field.inline ? "Give this field its own row" : "Let this field share a row"}
          title={field.inline ? "Own row" : "Share a row"}
          aria-pressed={!field.inline}
          disabled={disabled}
          onClick={onToggleInline}
          className={FIELD_BUTTON}
        >
          {field.inline ? <Rows2 className="size-3.5" /> : <Columns3 className="size-3.5" />}
        </button>
        <button type="button" aria-label="Remove field" title="Remove field" disabled={disabled} onClick={onRemove} className={FIELD_BUTTON}>
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
