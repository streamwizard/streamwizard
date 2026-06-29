import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getNodeAction } from "@/actions/nodes";
import { NodeDetailClient } from "@/components/admin/node-detail-client";
import { Button } from "@repo/ui";

export default async function NodeDetailPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const { user } = await getAuthContext();
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) notFound();

  const { data: node } = await getNodeAction(nodeId);
  if (!node) notFound();

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/dashboard/admin/nodes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Nodes
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{node.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{node.api_url ?? "no API URL set"}</p>
      </div>
      <NodeDetailClient node={node} />
    </div>
  );
}
