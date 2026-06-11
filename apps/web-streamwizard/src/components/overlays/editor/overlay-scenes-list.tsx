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
import { Badge } from "@repo/ui";
import {
  Copy,
  Edit,
  Layers,
  MoreVertical,
  Plus,
  Trash2,
  Monitor,
  Smartphone,
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
  render_mode?: string;
  created_at: string;
  updated_at: string;
}

type RenderMode = "obs" | "phone";

export function OverlayScenesList({ scenes }: { scenes: OverlayScene[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renderMode, setRenderMode] = useState<RenderMode>("obs");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsCreating(true);

    const { data, error } = await createOverlayScene({
      name: newName.trim(),
      render_mode: renderMode,
    });

    if (error) {
      toast.error(error);
    } else if (data) {
      toast.success("Overlay created");
      setDialogOpen(false);
      setNewName("");
      setRenderMode("obs");
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

  function getOverlayUrl(scene: OverlayScene) {
    return `${env.NEXT_PUBLIC_OVERLAY_URL}/${scene.slug}`;
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:flex justify-end">
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
                  placeholder="My Overlay"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>

              {/* OBS / Phone toggle */}
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenderMode("obs")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                      renderMode === "obs"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="font-medium">OBS</span>
                    <span className="text-xs text-center leading-tight opacity-70">
                      Browser source in OBS
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderMode("phone")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                      renderMode === "phone"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="font-medium">Phone</span>
                    <span className="text-xs text-center leading-tight opacity-70">
                      Rendered on your phone with GPS
                    </span>
                  </button>
                </div>
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">
                        {scene.name}
                      </CardTitle>
                      {scene.render_mode === "phone" ? (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] px-1.5">
                          <Smartphone className="h-2.5 w-2.5" />
                          Phone
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] px-1.5">
                          <Monitor className="h-2.5 w-2.5" />
                          OBS
                        </Badge>
                      )}
                    </div>
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
                      <DropdownMenuItem asChild className="hidden md:flex">
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
                        navigator.clipboard.writeText(getOverlayUrl(scene));
                        toast.success("URL copied");
                      }}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy URL
                    </Button>
                    <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
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
