"use client";

import { Button } from "@repo/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Switch } from "@repo/ui";
import {
  Copy,
  Edit,
  Layers,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import {
  createOverlayScene,
  deleteOverlayScene,
  duplicateOverlayScene,
  updateOverlayScene,
} from "@/actions/overlays";

interface OverlayScene {
  id: string;
  name: string;
  slug: string;
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function OverlayScenesList({ scenes }: { scenes: OverlayScene[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsCreating(true);

    const { data, error } = await createOverlayScene({ name: newName.trim() });

    if (error) {
      toast.error(error);
    } else if (data) {
      toast.success("Overlay created");
      setDialogOpen(false);
      setNewName("");
      router.push(`/dashboard/overlays/${data.id}/edit`);
    }

    setIsCreating(false);
  }

  async function handleDelete(id: string) {
    const { success, error } = await deleteOverlayScene(id);
    if (success) {
      toast.success("Overlay deleted");
      router.refresh();
    } else {
      toast.error(error ?? "Failed to delete");
    }
  }

  async function handleDuplicate(id: string) {
    const { data, error } = await duplicateOverlayScene(id);
    if (data) {
      toast.success("Overlay duplicated");
      router.refresh();
    } else {
      toast.error(error ?? "Failed to duplicate");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const { error } = await updateOverlayScene({ id, is_active: isActive });
    if (error) {
      toast.error(error);
    } else {
      toast.success(isActive ? "Overlay activated" : "Overlay deactivated");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Overlay
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Overlay</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overlay-name">Name</Label>
                <Input
                  id="overlay-name"
                  placeholder="My Clips Overlay"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Overlay"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {scenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No overlays yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first overlay to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => (
            <Card key={scene.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {scene.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {scene.width}x{scene.height} &middot; Updated{" "}
                      {new Date(scene.updated_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/overlays/${scene.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(scene.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(scene.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={scene.is_active}
                      onCheckedChange={(checked) =>
                        handleToggleActive(scene.id, checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {scene.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = `${env.NEXT_PUBLIC_OVERLAY_URL}/${scene.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Overlay URL copied");
                      }}
                      title="Copy OBS browser source URL"
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy URL
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/overlays/${scene.id}/edit`}>
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
