"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { ObsNode, ObsNodeCapacity } from "@repo/supabase/queries/obs-nodes";
import type { NodeHealthStatus } from "@/lib/node-health";
import { createNodeAction, deleteNodeAction, updateNodeAction } from "@/actions/nodes";

function copy(value: string, what: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${what} copied`);
}

const EMPTY_FORM: ObsNodeCapacity = {
  name: "",
  max_instances: 10,
  memory_mb: 4096,
  cpu_quota: 1,
  vram_mb: 2048,
  total_vram_mb: 8192,
  shm_size: "2g",
  api_url: "",
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "linked") return "default";
  if (status === "pending") return "secondary";
  return "outline";
}

function healthVariant(health: NodeHealthStatus): "default" | "secondary" | "outline" | "destructive" {
  if (health === "online") return "default";
  if (health === "unlinked") return "outline";
  return "destructive"; // offline, unreachable
}

function healthLabel(health: NodeHealthStatus): string {
  if (health === "online") return "Online";
  if (health === "offline") return "Offline";
  if (health === "unreachable") return "Unreachable";
  return "Not linked";
}

function NodeForm({
  form,
  setForm,
}: {
  form: ObsNodeCapacity;
  setForm: (form: ObsNodeCapacity) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-2">
        <Label htmlFor="node-name">Name</Label>
        <Input
          id="node-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="node-api-url">API URL</Label>
        <Input
          id="node-api-url"
          placeholder="http://10.10.10.185:3000"
          value={form.api_url}
          onChange={(e) => setForm({ ...form, api_url: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-max-instances">Max instances</Label>
        <Input
          id="node-max-instances"
          type="number"
          value={form.max_instances}
          onChange={(e) => setForm({ ...form, max_instances: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-memory">Memory (MB)</Label>
        <Input
          id="node-memory"
          type="number"
          value={form.memory_mb}
          onChange={(e) => setForm({ ...form, memory_mb: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-cpu-quota">CPU quota</Label>
        <Input
          id="node-cpu-quota"
          type="number"
          step="0.1"
          value={form.cpu_quota}
          onChange={(e) => setForm({ ...form, cpu_quota: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-shm-size">Shm size</Label>
        <Input
          id="node-shm-size"
          value={form.shm_size}
          onChange={(e) => setForm({ ...form, shm_size: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-vram">VRAM reserved per instance (MB)</Label>
        <Input
          id="node-vram"
          type="number"
          value={form.vram_mb}
          onChange={(e) => setForm({ ...form, vram_mb: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="node-total-vram">Total VRAM on node (MB)</Label>
        <Input
          id="node-total-vram"
          type="number"
          value={form.total_vram_mb}
          onChange={(e) => setForm({ ...form, total_vram_mb: Number(e.target.value) })}
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
      memory_mb: node.memory_mb,
      cpu_quota: node.cpu_quota,
      vram_mb: node.vram_mb,
      total_vram_mb: node.total_vram_mb,
      shm_size: node.shm_size,
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
    toast.success("Node deleted.");
  };

  return (
    <>
      {installCommand && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Install command — copy this now</CardTitle>
            <CardDescription>
              This is the only time the claim token will be shown. Run this on the node to link it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">
                {installCommand}
              </pre>
              <Button size="icon" variant="ghost" onClick={() => copy(installCommand, "Install command")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" className="mt-3" onClick={() => setInstallCommand(null)}>
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Nodes</CardTitle>
            <CardDescription>GPU hosts running obs-instance-manager.</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateForm(EMPTY_FORM)}>Add node</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add node</DialogTitle>
                <DialogDescription>
                  Set the capacity this node should advertise. You&apos;ll get a one-time install
                  command after saving.
                </DialogDescription>
              </DialogHeader>
              <NodeForm form={createForm} setForm={setCreateForm} />
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isPending || !createForm.name || !createForm.api_url}>
                  {isPending ? "Creating…" : "Create node"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>API URL</TableHead>
                <TableHead>Link status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Max instances</TableHead>
                <TableHead>VRAM (alloc/total)</TableHead>
                <TableHead>GPU bus ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => {
                const health = healthByNodeId[node.id] ?? "unreachable";
                return (
                  <TableRow key={node.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/admin/nodes/${node.id}`} className="hover:underline">
                        {node.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{node.api_url ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(node.status)}>{node.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={healthVariant(health)}>{healthLabel(health)}</Badge>
                    </TableCell>
                    <TableCell>{node.max_instances}</TableCell>
                    <TableCell>
                      {node.vram_mb} / {node.total_vram_mb}
                    </TableCell>
                    <TableCell>{node.gpu_bus_id ?? "—"}</TableCell>
                    <TableCell>{new Date(node.created_at).toLocaleString("en-US")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(node)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this node?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{node.name}&quot; will be removed. Any instances already running on it
                              aren&apos;t cleaned up by this action — this can&apos;t be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(node.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit node</DialogTitle>
            <DialogDescription>Update this node&apos;s capacity settings.</DialogDescription>
          </DialogHeader>
          <NodeForm form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button onClick={handleEdit} disabled={isPending || !editForm.name}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
