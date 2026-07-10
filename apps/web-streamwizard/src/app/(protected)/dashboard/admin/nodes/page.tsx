import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listNodesAction } from "@/actions/nodes";
import { checkNodesHealth } from "@/lib/node-health";
import { NodesSection } from "@/components/admin/nodes-section";

export default async function AdminNodesPage() {
  const { user } = await getAuthContext();
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

    console.log(roleRow)
  if (!roleRow) notFound();

  const { data: nodes, error } = await listNodesAction();
  const healthByNodeId = nodes ? await checkNodesHealth(nodes) : {};

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OBS Cloud Nodes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage GPU host nodes that run obs-instance-manager.
        </p>
      </div>
      <NodesSection initialNodes={nodes ?? []} error={error} healthByNodeId={healthByNodeId} />
    </div>
  );
}
