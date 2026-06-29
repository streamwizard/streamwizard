"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
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
  Input,
  Label,
} from "@repo/ui";
import {
  type IngestOutputKey,
  createOutputKey,
  deleteOutputKey,
  rotateOutputKey,
} from "@/actions/ingest-output-keys";

function copy(value: string, what: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${what} copied`);
}

/** The SRT URL an OBS Media Source uses to pull a feed from the ingest server. */
function obsPullUrl(host: string, outputKey: string) {
  return `srt://${host}:9000?streamid=${outputKey}&latency=4000`;
}

export function IngestOutputKeysSection({
  initialKeys,
  streamKeyId,
  obsPullHost,
}: {
  initialKeys: IngestOutputKey[];
  // The incoming key these output keys pull from. Without one, there's nothing
  // to attach an output key to yet.
  streamKeyId: string | null;
  obsPullHost: string;
}) {
  const [keys, setKeys] = useState<IngestOutputKey[]>(initialKeys);
  const [label, setLabel] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleCreate = async () => {
    if (!streamKeyId) return;
    setIsPending(true);
    const { data, error } = await createOutputKey(streamKeyId, label);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that output key. Try again.");
      return;
    }
    setKeys((prev) => [data, ...prev]);
    setLabel("");
    toast.success("Output key ready. Paste the OBS URL into a Media Source.");
  };

  const handleRotate = async (id: string) => {
    const { data, error } = await rotateOutputKey(id);
    if (error || !data) {
      toast.error(error ?? "Couldn't rotate that output key.");
      return;
    }
    setKeys((prev) => prev.map((k) => (k.id === id ? data : k)));
    toast.success("Output key rotated. Update the OBS Media Source URL.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteOutputKey(id);
    if (error) {
      toast.error(error);
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("Output key deleted.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OBS output</CardTitle>
        <CardDescription>
          Add a Media Source in OBS using one of these SRT URLs to pull your live feed. Each output
          key is a separate pull — create one per OBS instance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!streamKeyId ? (
          <p className="text-muted-foreground text-sm">
            Create a stream key first — output keys pull from an incoming stream.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="output-key-label">New output key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="output-key-label"
                placeholder="Label (e.g. Main OBS, BRB scene checker)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isPending}
              />
              <Button onClick={handleCreate} disabled={isPending}>
                {isPending ? "Creating…" : "Create output key"}
              </Button>
            </div>
          </div>
        )}

        {keys.length > 0 && (
          <div className="space-y-3">
            {keys.map((key) => {
              const url = obsPullUrl(obsPullHost, key.output_key);
              return (
                <div key={key.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.label}</span>
                      {!key.is_active && <Badge variant="outline">disabled</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleRotate(key.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this output key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Any OBS Media Source using &quot;{key.label}&quot; stops pulling
                              immediately. This can&apos;t be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(key.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-16 justify-center">
                      OBS
                    </Badge>
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <Button size="icon" variant="ghost" onClick={() => copy(url, "OBS URL")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
