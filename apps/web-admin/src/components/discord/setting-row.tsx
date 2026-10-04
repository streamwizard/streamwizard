import { Label } from "@repo/ui";

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

// The save bar moved next to the other shared widgets; re-exported so the
// settings forms keep importing both from here.
export { SaveBar } from "@/components/widgets/save-bar";
