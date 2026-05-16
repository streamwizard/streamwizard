import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { getPendingLibraryEntries } from "@/actions/widgets";
import { AdminWidgetLibraryClient } from "./admin-widget-library-client";

export default async function AdminWidgetLibraryPage() {
  const { user } = await getAuthContext();
  if (user.app_metadata?.is_admin !== true) notFound();

  const { data: entriesRaw, error } = await getPendingLibraryEntries();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Widget Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve community widget submissions.
        </p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AdminWidgetLibraryClient entries={(entriesRaw ?? []) as any} error={error} />
    </div>
  );
}
