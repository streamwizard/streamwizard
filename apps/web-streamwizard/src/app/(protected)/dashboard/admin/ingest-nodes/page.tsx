import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listIngestNodesAction } from "@/actions/ingest-nodes";
import { IngestNodesSection } from "@/components/admin/ingest-nodes-section";

export default async function AdminIngestNodesPage() {
  const { user } = await getAuthContext();
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) notFound();

  const { data: nodes, error } = await listIngestNodesAction();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ingest Nodes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage SRT/SRTLA ingest boxes running ingest-server.
        </p>
      </div>
      <IngestNodesSection initialNodes={nodes ?? []} error={error} />
    </div>
  );
}
