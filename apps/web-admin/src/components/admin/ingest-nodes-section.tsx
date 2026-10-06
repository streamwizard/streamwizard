"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@repo/ui";
import type { IngestNode, IngestNodeCapacity } from "@repo/supabase/queries/ingest-nodes";
import { createIngestNodeAction, deleteIngestNodeAction, updateIngestNodeAction } from "@/actions/ingest-nodes";
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
import { ingestNodeCapacitySchema } from "@/schemas/ingest-node";
import { formatMb } from "@/lib/format";
import { nodeStatusVariant } from "@/lib/node-ui";

const EMPTY_FORM: IngestNodeCapacity = {
  name: "",
  max_concurrent_sessions: null,
  public_hostname: null,
};

/** Compact summary of what install.sh self-reported at claim time. No health
 * column here (unlike OBS nodes) -- ingest-control never publishes its HTTP
 * port, so there's nothing for the admin's browser to reach and poll. */
function HardwareSummary({ node }: { node: IngestNode }) {
  if (node.status !== "linked") {
    return <span className="text-xs text-muted-foreground">Not linked yet</span>;
  }
  return (
    <div className="text-xs">
      <p className="font-medium">
        {formatMb(node.ram_total_mb)} RAM · {node.cpu_cores ?? "—"} cores
      </p>
      <p className="text-muted-foreground">
        {node.public_ip ?? "no public IP"} · lan {node.lan_ip ?? "—"} · tailscale {node.tailscale_ip ?? "—"}
      </p>
    </div>
  );
}

function IngestNodeForm({
  form,
  setForm,
}: {
  form: IngestNodeCapacity;
  setForm: (form: IngestNodeCapacity) => void;
}) {
  const nameResult = ingestNodeCapacitySchema.shape.name.safeParse(form.name);
  const nameError = !nameResult.success && form.name.length > 0 ? nameResult.error.issues[0]?.message : null;

  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="ingest-node-name">Name (this becomes the node&apos;s hostname)</Label>
        <Input
          id="ingest-node-name"
          placeholder="ingest-box-1"
          autoCapitalize="none"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ingest-node-max-sessions">Max concurrent sessions (optional)</Label>
        <Input
          id="ingest-node-max-sessions"
          type="number"
          inputMode="numeric"
          value={form.max_concurrent_sessions ?? ""}
          onChange={(e) =>
            setForm({ ...form, max_concurrent_sessions: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ingest-node-public-hostname">Public domain (optional)</Label>
        <Input
          id="ingest-node-public-hostname"
          placeholder="ingest-01.streamwizard.org"
          inputMode="url"
          autoCapitalize="none"
          value={form.public_hostname ?? ""}
          onChange={(e) => setForm({ ...form, public_hostname: e.target.value === "" ? null : e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Point a DNS record at this box, then set it here. Encoders connect to this domain
          instead of the raw IP. Leave blank to use the public IP.
        </p>
      </div>
    </div>
  );
}

export function IngestNodesSection({
  initialNodes,
  error,
}: {
  initialNodes: IngestNode[];
  error: string | null;
}) {
  const [nodes, setNodes] = useState<IngestNode[]>(initialNodes);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<IngestNodeCapacity>(EMPTY_FORM);
  const [isPending, setIsPending] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  const [editingNode, setEditingNode] = useState<IngestNode | null>(null);
  const [editForm, setEditForm] = useState<IngestNodeCapacity>(EMPTY_FORM);

  const [deletingNode, setDeletingNode] = useState<IngestNode | null>(null);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createIngestNodeAction(createForm);
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

  const openEdit = (node: IngestNode) => {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      max_concurrent_sessions: node.max_concurrent_sessions,
      public_hostname: node.public_hostname,
    });
  };

  const handleEdit = async () => {
    if (!editingNode) return;
    setIsPending(true);
    const { data, error } = await updateIngestNodeAction(editingNode.id, editForm);
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
    const { error } = await deleteIngestNodeAction(id);
    if (error) {
      toast.error(error);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setDeletingNode(null);
    toast.success("Node deleted.");
  };

  const columns: DataColumn<IngestNode>[] = [
    {
      key: "name",
      header: "Name",
      mobile: "title",
      className: "max-w-64 whitespace-normal",
      cell: (node) => (
        <>
          <span className="font-medium">{node.name}</span>
          {node.public_hostname && <span className="block text-xs font-normal break-all text-muted-foreground">{node.public_hostname}</span>}
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
      key: "max",
      header: "Max sessions",
      className: "tabular-nums",
      cell: (node) => node.max_concurrent_sessions ?? "Unlimited",
    },
    {
      key: "hardware",
      header: "Hardware",
      className: "hidden min-w-44 whitespace-normal @4xl:table-cell",
      headClassName: "hidden @4xl:table-cell",
      cell: (node) => <HardwareSummary node={node} />,
    },
    {
      key: "created",
      header: "Created",
      mobile: "hidden",
      className: "hidden text-muted-foreground @6xl:table-cell",
      headClassName: "hidden @6xl:table-cell",
      // Formatted in the viewer's time zone, which the server render cannot know.
      cell: (node) => <span suppressHydrationWarning>{new Date(node.created_at).toLocaleDateString("en-US")}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {installCommand && (
        <InstallCommandCard
          command={installCommand}
          description="This is the only time the claim token will be shown. The node joins Tailscale automatically during install, so no auth key needs to be pasted in."
          onDismiss={() => setInstallCommand(null)}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <CardTitle>Ingest nodes</CardTitle>
            <CardDescription>SRT/SRTLA boxes running ingest-server.</CardDescription>
          </div>
          <ResponsiveDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button className="h-11 md:h-9" onClick={() => setCreateForm(EMPTY_FORM)}>
                Add node
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Add ingest node</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Name it and optionally cap how many concurrent sessions it should handle.
                  Hardware details (RAM, CPU, storage, public IP, Tailscale IP, hostname) are
                  self-reported by the node when you run the one-time install command you&apos;ll
                  get after saving.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <IngestNodeForm form={createForm} setForm={setCreateForm} />
              <ResponsiveDialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !ingestNodeCapacitySchema.safeParse(createForm).success}
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
            <ResponsiveDialogTitle>Edit ingest node</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Update this node&apos;s capacity settings.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <IngestNodeForm form={editForm} setForm={setEditForm} />
          <ResponsiveDialogFooter>
            <Button
              onClick={handleEdit}
              disabled={isPending || !ingestNodeCapacitySchema.safeParse(editForm).success}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <DeleteNodeDialog node={deletingNode} leftRunning="sessions" onClose={() => setDeletingNode(null)} onDelete={handleDelete} />
    </div>
  );
}
