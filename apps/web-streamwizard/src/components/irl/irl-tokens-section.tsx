"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
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
  type IrlCollectorToken,
  createIrlToken,
  deleteIrlToken,
} from "@/actions/irl-tokens";

function copy(value: string, what: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${what} copied`);
}

export function IrlTokensSection({
  initialTokens,
  canInteract = true,
}: {
  initialTokens: IrlCollectorToken[];
  canInteract?: boolean;
}) {
  const [tokens, setTokens] = useState<IrlCollectorToken[]>(initialTokens);
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createIrlToken(name || "My IRL Device");
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that device link. Try again.");
      return;
    }
    setLatestUrl(data.token_url);
    setName("");
    toast.success("Device link ready. Open it on your phone to start sending location.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteIrlToken(id);
    if (error) {
      toast.error(error);
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
    toast.success("Device link removed.");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Location devices</CardTitle>
          <CardDescription>
            Generate a link for your phone (IRL Pro, GPS app) to send live location to your
            overlays while you&apos;re out streaming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {latestUrl && (
            <div className="space-y-2">
              <Label>Open this on the device</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={latestUrl} className="font-mono text-xs" />
                <Button size="icon" variant="ghost" onClick={() => copy(latestUrl, "Device link")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="device-name">New device</Label>
            <div className="flex items-center gap-2">
              <Input
                id="device-name"
                placeholder="Label (e.g. Phone, backup tracker)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
              <Button onClick={handleCreate} disabled={!canInteract || isPending}>
                {isPending ? "Creating…" : "Create link"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {tokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your devices</CardTitle>
            <CardDescription>Remove a device you&apos;re done with.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="font-medium">{token.name}</span>
                  <p className="text-muted-foreground text-xs">
                    {token.last_used_at
                      ? `Last used ${new Date(token.last_used_at).toLocaleString()}`
                      : "Never used"}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" disabled={!canInteract}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this device?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &quot;{token.name}&quot; stops sending location immediately. This can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(token.id)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
