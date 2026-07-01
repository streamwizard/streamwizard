"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { FaDiscord } from "react-icons/fa";
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
  type IngestStreamKey,
  createIngestKey,
  deleteIngestKey,
  rotateIngestKey,
  sendIngestKeyDiscordDM,
} from "@/actions/ingest-keys";

function copy(value: string, what: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${what} copied`);
}

function formatLastUsed(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ingestUrls(host: string, key: string) {
  return [
    { protocol: "SRT", url: `srt://${host}:8888?streamid=${key}` },
    { protocol: "SRTLA", url: `host ${host} · port 5000 · streamid ${key}` },
  ];
}

export function IngestKeysSection({
  initialKeys,
  ingestHost,
  canInteract = true,
}: {
  initialKeys: IngestStreamKey[];
  ingestHost: string;
  canInteract?: boolean;
}) {
  const [keys, setKeys] = useState<IngestStreamKey[]>(initialKeys);
  const [label, setLabel] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sendingDmId, setSendingDmId] = useState<string | null>(null);

  const activeKey = keys[0];

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createIngestKey(label);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that key. Try again.");
      return;
    }
    setKeys((prev) => [data, ...prev]);
    setLabel("");
    toast.success("New ingest key ready. Paste it into your encoder.");
  };

  const handleRotate = async (id: string) => {
    const { data, error } = await rotateIngestKey(id);
    if (error || !data) {
      toast.error(error ?? "Couldn't rotate that key.");
      return;
    }
    setKeys((prev) => prev.map((k) => (k.id === id ? data : k)));
    toast.success("Key rotated. The old one stops working now — update your encoder.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteIngestKey(id);
    if (error) {
      toast.error(error);
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("Key deleted.");
  };

  const handleSendDm = async (id: string) => {
    setSendingDmId(id);
    const { error } = await sendIngestKeyDiscordDM(id);
    setSendingDmId(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Sent. Check your Discord DMs.");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Stream ingest</CardTitle>
          <CardDescription>
            Push your IRL feed to StreamWizard over SRT or SRTLA. Your stream key is the
            password — anyone who has it can stream as you, so treat it like one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeKey ? (
            <div className="space-y-3">
              <Label>Your ingest URLs</Label>
              {ingestUrls(ingestHost, activeKey.stream_key).map(({ protocol, url }) => (
                <div key={protocol} className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-16 justify-center">
                    {protocol}
                  </Badge>
                  <Input readOnly value={url} className="font-mono text-xs" />
                  <Button size="icon" variant="ghost" onClick={() => copy(url, `${protocol} URL`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-muted-foreground text-xs">
                SRT and SRTLA carry the key in the <code>streamid</code> field. Using bonded
                connections (Belabox, IRLToolkit, Moblin)? Point them at the SRTLA host above.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No keys yet. Create one below and you&apos;ll get your ingest URLs.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="key-label">New key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="key-label"
                placeholder="Label (e.g. Belabox, phone, backup)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isPending}
              />
              <Button onClick={handleCreate} disabled={!canInteract || isPending}>
                {isPending ? "Creating…" : "Create key"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {keys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your keys</CardTitle>
            <CardDescription>Rotate a key if it leaks. Delete one you&apos;re done with.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.label}</span>
                    {!key.is_active && <Badge variant="outline">disabled</Badge>}
                  </div>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {key.stream_key.slice(0, 12)}…
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {key.last_used_at ? `Last used ${formatLastUsed(key.last_used_at)}` : "Never used"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => copy(key.stream_key, "Stream key")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!canInteract || sendingDmId === key.id}
                    onClick={() => handleSendDm(key.id)}
                    title="Send to Discord"
                  >
                    {sendingDmId === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FaDiscord className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" disabled={!canInteract} onClick={() => handleRotate(key.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" disabled={!canInteract}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Any encoder using &quot;{key.label}&quot; stops working immediately. This can&apos;t be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(key.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
