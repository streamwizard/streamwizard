"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@repo/ui";
import type { ObsNode, ObsNodeCapacity } from "@repo/supabase/queries/obs-nodes";
import type { NodeHealthStatus } from "@/lib/node-health";
import { createNodeAction, deleteNodeAction, updateNodeAction } from "@/actions/nodes";
import { DeleteNodeDialog, InstallCommandCard } from "@/components/admin/node-manage-kit";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/widgets/responsive-dialog";
import { obsNodeCapacitySchema } from "@/schemas/obs-node";
import { formatMb } from "@/lib/format";
import { nodeHealthLabel, nodeHealthVariant, nodeStatusVariant } from "@/lib/node-ui";

const EMPTY_FORM: ObsNodeCapacity = {
  name: "",
  max_instances: 10,
  api_url: "",
};

/** Compact, two-line summary of what install.sh self-reported at claim time. */
function HardwareSummary({ node }: { node: ObsNode }) {
  if (node.status !== "linked") {
    return <span className="text-xs text-muted-foreground">Not linked yet</span>;
  }
  return (
    <div className="text-xs">
      <p className="font-medium">
        {node.gpu_model ?? "GPU"}
        {node.total_vram_mb != null ? ` · ${formatMb(node.total_vram_mb)} VRAM` : ""}
      </p>
      <p className="text-muted-foreground">
        {formatMb(node.ram_total_mb)} RAM · {node.cpu_cores ?? "—"} cores · tailscale {node.tailscale_ip ?? "—"}
      </p>
    </div>
  );
}

function NodeForm({
  form,
  setForm,
}: {
  form: ObsNodeCapacity;
  setForm: (form: ObsNodeCapacity) => void;
}) {
  const nameResult = obsNodeCapacitySchema.shape.name.safeParse(form.name);
  const nameError = !nameResult.success && form.name.length > 0 ? nameResult.error.issues[0]?.message : null;

  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="node-name">Name (this becomes the node&apos;s hostname)</Label>
        <Input
          id="node-name"
          placeholder="gpu-box-1"
          autoCapitalize="none"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-api-url">API URL (optional)</Label>
        <Input
          id="node-api-url"
          placeholder="http://100.64.0.10:3000"
          inputMode="url"
          autoCapitalize="none"
          value={form.api_url ?? ""}
          onChange={(e) => setForm({ ...form, api_url: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank and the node fills this in with its Tailscale address when it links. Set it only
          to override that, e.g. a tunnel hostname for browsers outside the tailnet.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-max-instances">Max instances</Label>
        <Input
          id="node-max-instances"
          type="number"
          inputMode="numeric"
          value={form.max_instances}
          onChange={(e) => setForm({ ...form, max_instances: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export function NodesSection({
  initialNodes,
  error,
  healthByNodeId,
}: {
  initialNodes: ObsNode[];
  error: string | null;
  healthByNodeId: Record<string, NodeHealthStatus>;
}) {
  const [nodes, setNodes] = useState<ObsNode[]>(initialNodes);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ObsNodeCapacity>(EMPTY_FORM);
  const [isPending, setIsPending] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  const [editingNode, setEditingNode] = useState<ObsNode | null>(null);
  const [editForm, setEditForm] = useState<ObsNodeCapacity>(EMPTY_FORM);

  const [deletingNode, setDeletingNode] = useState<ObsNode | null>(null);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createNodeAction(createForm);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that node. Try again.");
      return;
    }
    setNodes((prev) => [data.node, ...prev]);
    setIsCreateOpen(false);
    setCreateForm(EMPTY_FORM);
    setInstallCommand(data.installCommand);
  };

  const openEdit = (node: ObsNode) => {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      max_instances: node.max_instances,
      api_url: node.api_url ?? "",
    });
  };

  const handleEdit = async () => {
    if (!editingNode) return;
    setIsPending(true);
    const { data, error } = await updateNodeAction(editingNode.id, editForm);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't update that node. Try again.");
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === data.id ? data : n)));
    setEditingNode(null);
    toast.success("Node updated.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteNodeAction(id);
    if (error) {
      toast.error(error);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setDeletingNode(null);
    toast.success("Node deleted.");
  };

  const columns: DataColumn<ObsNode>[] = [
    {
      key: "name",
      header: "Name",
      mobile: "title",
      className: "max-w-64 whitespace-normal",
      cell: (node) => (
        <>
          <span className="font-medium">{node.name}</span>
          <span className="block font-mono text-xs font-normal break-all text-muted-foreground">{node.api_url ?? "no API URL"}</span>
        </>
      ),
    },
    {
      key: "status",
      header: "Link status",
      mobile: "badge",
      cell: (node) => <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>,
    },
    {
      // Probed once when the page loaded. The Fleet tab has the refreshing view.
      key: "health",
      header: "Health at load",
      cell: (node) => {
        const health = healthByNodeId[node.id] ?? "unreachable";
        return <Badge variant={nodeHealthVariant(health)}>{nodeHealthLabel(health)}</Badge>;
      },
    },
    { key: "max", header: "Max instances", className: "tabular-nums", cell: (node) => node.max_instances },
    {
      key: "hardware",
      header: "Hardware",
      className: "hidden min-w-44 whitespace-normal @5xl:table-cell",
      headClassName: "hidden @5xl:table-cell",
      cell: (node) => <HardwareSummary node={node} />,
    },
    {
      key: "created",
      header: "Created",
      mobile: "hidden",
      className: "hidden text-muted-foreground @7xl:table-cell",
      headClassName: "hidden @7xl:table-cell",
      // Formatted in the viewer's time zone, which the server render cannot know.
      cell: (node) => <span suppressHydrationWarning>{new Date(node.created_at).toLocaleDateString("en-US")}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {installCommand && (
        <InstallCommandCard
          command={installCommand}
          description="This is the only time the claim token will be shown. Run this on the node to link it."
          onDismiss={() => setInstallCommand(null)}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <CardTitle>Nodes</CardTitle>
            <CardDescription>GPU hosts running obs-instance-manager.</CardDescription>
          </div>
          <ResponsiveDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button className="h-11 md:h-9" onClick={() => setCreateForm(EMPTY_FORM)}>
                Add node
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Add node</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Name it and cap how many instances it can run. Hardware details (GPU, VRAM, RAM,
                  CPU, storage, hostname) and the API URL are self-reported by the node when you run
                  the one-time install command you&apos;ll get after saving.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <NodeForm form={createForm} setForm={setCreateForm} />
              <ResponsiveDialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !obsNodeCapacitySchema.safeParse(createForm).success}
                >
                  {isPending ? "Creating…" : "Create node"}
                </Button>
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </CardHeader>
        {/* Phone cards run edge to edge; the table keeps the card's padding. */}
        <CardContent className="px-0 sm:px-6">
          {nodes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No nodes yet. Add one to get its install command.</p>
          ) : (
            <DataList
              rows={nodes}
              rowKey={(node) => node.id}
              rowHref={(node) => `/obs/${node.id}`}
              columns={columns}
              actions={(node) => (
                <div className="flex flex-wrap items-center gap-2 @2xl:flex-nowrap @2xl:justify-end">
                  <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={() => openEdit(node)}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11 text-destructive hover:text-destructive md:h-8"
                    onClick={() => setDeletingNode(node)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Edit node</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Update this node&apos;s capacity settings.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <NodeForm form={editForm} setForm={setEditForm} />
          <ResponsiveDialogFooter>
            <Button
              onClick={handleEdit}
              disabled={isPending || !obsNodeCapacitySchema.safeParse(editForm).success}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <DeleteNodeDialog node={deletingNode} leftRunning="instances" onClose={() => setDeletingNode(null)} onDelete={handleDelete} />
    </div>
  );
}
