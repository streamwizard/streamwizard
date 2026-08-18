/*
 * Structural placeholder for imagery the user still has to capture (real
 * screenshots beat anything invented here). The label states exactly what
 * belongs in the slot.
 */
export function ImageSlot({ label, ratio = "16/9", className = "" }: { label: string; ratio?: string; className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-xl border border-dashed border-border bg-card/40 p-6 text-center ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <span className="max-w-xs font-mono text-xs text-muted-foreground/80">[IMAGE: {label}]</span>
    </div>
  );
}
