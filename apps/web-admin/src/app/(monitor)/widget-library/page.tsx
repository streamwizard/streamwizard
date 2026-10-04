import { Alert, AlertDescription, AlertTitle } from "@repo/ui";
import { getPendingLibraryEntries } from "@/actions/widget-library";
import { AdminWidgetLibraryClient, type PendingEntry } from "@/components/widget-library/admin-widget-library-client";
import { PageHeader } from "@/components/widgets/page-header";

export const dynamic = "force-dynamic";

function describe(count: number, failed: boolean): string {
  if (failed) return "Community widget submissions waiting for a decision.";
  if (count === 0) return "No submissions waiting. Approved widgets go into the public library.";
  return `${count} submission${count === 1 ? "" : "s"} waiting. Approving puts a widget in the public library; rejecting deletes the submission.`;
}

export default async function AdminWidgetLibraryPage() {
  const { data, error } = await getPendingLibraryEntries();
  const entries = (data ?? []) as unknown as PendingEntry[];

  return (
    <div className="space-y-6">
      <PageHeader title="Widget review" description={describe(entries.length, !!error)} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load the submissions</AlertTitle>
          <AlertDescription>{error}. Reload to try again.</AlertDescription>
        </Alert>
      ) : (
        <AdminWidgetLibraryClient entries={entries} />
      )}
    </div>
  );
}
