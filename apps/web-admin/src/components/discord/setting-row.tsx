import { Button, Label } from "@repo/ui";

/** One labelled setting: label and hint on the left, control on the right (stacks on mobile). */
export function SettingRow({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center sm:gap-6">
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex min-w-0 sm:justify-end">{children}</div>
    </div>
  );
}

/** Save bar for a settings card: shows only when there's something to save. */
export function SaveBar({
  dirty,
  pending,
  onSave,
  onReset,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-4">
      <Button size="sm" variant="ghost" onClick={onReset} disabled={pending}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
