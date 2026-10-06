"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, PackageCheck, X } from "lucide-react";
import { approveLibraryEntry, rejectLibraryEntry } from "@/actions/widget-library";
import { buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui";

export interface PendingEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  created_at: string;
  overlay_widgets: {
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
  };
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AdminWidgetLibraryClient({ entries }: { entries: PendingEntry[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingEntry | null>(null);

  // Both actions answer { error }. Nothing is swallowed: a failure is a toast and the card stays.
  function run(entry: PendingEntry, action: (id: string) => Promise<{ error: string | null }>, done: string, onDone?: () => void) {
    setActionId(entry.id);
    startTransition(async () => {
      try {
        const result = await action(entry.id);
        if (result.error) {
          toast.error(`Couldn't update "${entry.title}"`, { description: result.error });
          return;
        }
        toast.success(done);
        onDone?.();
        router.refresh();
      } catch {
        toast.error(`Couldn't update "${entry.title}"`, { description: "The request didn't go through. Try again." });
      } finally {
        setActionId(null);
      }
    });
  }

  if (entries.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageCheck />
          </EmptyMedia>
          <EmptyTitle>Nothing to review</EmptyTitle>
          <EmptyDescription>New community submissions show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* One card per row until there's room for two: with the sidebar open that's 1024px, not 768px. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const srcdoc = buildWidgetSrcdoc(
            entry.overlay_widgets.html,
            entry.overlay_widgets.js,
            entry.overlay_widgets.extra_css,
            entry.overlay_widgets.fields,
            mergeFieldValues(entry.overlay_widgets.fields, {})
          );
          const busy = isPending && actionId === entry.id;
          return (
            <Card key={entry.id} className="gap-4 overflow-hidden pt-0">
              <div className="relative h-48 bg-black">
                {/* The srcdoc embeds the page's CSP nonce, which only the browser can read, so the server's copy never matches. */}
                <iframe
                  srcDoc={srcdoc}
                  sandbox="allow-scripts"
                  className="absolute inset-0 h-full w-full border-0"
                  title={`Preview of ${entry.title}`}
                  suppressHydrationWarning
                />
              </div>
              <CardHeader>
                <CardTitle className="text-base [overflow-wrap:anywhere]">{entry.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {entry.description && <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{entry.description}</p>}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Submitted {date(entry.created_at)}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button className="h-11 flex-1 md:h-9" onClick={() => run(entry, approveLibraryEntry, `"${entry.title}" is in the library.`)} disabled={busy}>
                  <Check aria-hidden />
                  {busy ? "Working…" : "Approve"}
                </Button>
                <Button variant="outline" className="h-11 flex-1 text-destructive hover:text-destructive md:h-9" onClick={() => setRejecting(entry)} disabled={busy}>
                  <X aria-hidden />
                  Reject
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!rejecting} onOpenChange={(open) => !open && !isPending && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject &quot;{rejecting?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the submission for good. The creator keeps the widget in their own account and can submit it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                // Stay open until the delete answers, so a failure isn't hidden behind a closed dialog.
                event.preventDefault();
                if (rejecting) run(rejecting, rejectLibraryEntry, `"${rejecting.title}" was rejected.`, () => setRejecting(null));
              }}
            >
              {isPending ? "Rejecting…" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
