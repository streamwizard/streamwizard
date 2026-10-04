import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";

/**
 * Save bar for a settings form: shows only when there's something to save.
 * `sticky` keeps it in view while the form scrolls, above the phone bottom bar;
 * use it once per page, for the form's one save.
 */
export function SaveBar({
  dirty,
  pending,
  onSave,
  onReset,
  sticky = false,
  saveLabel = "Save changes",
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
  sticky?: boolean;
  saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        sticky
          ? "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur md:bottom-4"
          : "border-t pt-4",
      )}
    >
      {sticky && <p className="mr-auto text-sm text-muted-foreground">Unsaved changes</p>}
      <Button size="sm" variant="ghost" className="h-11 md:h-8" onClick={onReset} disabled={pending}>
        Discard
      </Button>
      <Button size="sm" className="h-11 md:h-8" onClick={onSave} disabled={pending}>
        {pending ? "Saving…" : saveLabel}
      </Button>
    </div>
  );
}
