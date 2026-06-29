import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getNodeAction, getInstanceAction } from "@/actions/nodes";
import { InstanceDetailClient } from "@/components/admin/instance-detail-client";
import { Button } from "@repo/ui";

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ nodeId: string; instanceId: string }>;
}) {
  const { nodeId, instanceId } = await params;
  const { user } = await getAuthContext();
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) notFound();

  const [{ data: node }, { data: instance }] = await Promise.all([getNodeAction(nodeId), getInstanceAction(instanceId)]);
  if (!node || !instance || instance.node_id !== nodeId) notFound();

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/dashboard/admin/nodes/${nodeId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {node.name}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-mono">{instance.container_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</p>
      </div>
      <InstanceDetailClient node={node} instance={instance} />
    </div>
  );
}
