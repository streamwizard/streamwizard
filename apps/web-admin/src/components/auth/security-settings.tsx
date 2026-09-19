"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, KeyRound, Pencil, ShieldAlert, ShieldCheck, Smartphone, Trash2, X } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";
import { removePasskeyAction, removeTotpFactorAction } from "@/actions/security";
import { TotpEnroll } from "@/components/auth/totp-enroll";
import { PasskeyRegister } from "@/components/auth/passkey-register";

export type TotpFactorView = { id: string; friendlyName: string; createdAt: string };
export type PasskeyView = { id: string; friendlyName: string; createdAt: string; lastUsedAt: string | null };

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SecuritySettings({ totp, passkeys }: { totp: TotpFactorView | null; passkeys: PasskeyView[] }) {
  const router = useRouter();
  const [addingTotp, setAddingTotp] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const methodCount = (totp ? 1 : 0) + passkeys.length;
  const hasBoth = Boolean(totp) && passkeys.length > 0;

  const removeTotp = async () => {
    if (!totp) return;
    setBusyId(totp.id);
    const { error } = await removeTotpFactorAction(totp.id);
    setBusyId(null);
    if (error) return void toast.error(error);
    toast.success("Authenticator removed.");
    router.refresh();
  };

  const removePasskey = async (id: string) => {
    setBusyId(id);
    const { error } = await removePasskeyAction(id);
    setBusyId(null);
    if (error) return void toast.error(error);
    toast.success("Passkey removed.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {hasBoth ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Protected by both methods</AlertTitle>
          <AlertDescription>Lose a device and the other method still gets you in.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Only one method set up</AlertTitle>
          <AlertDescription>
            {totp
              ? "Add a passkey so a lost phone doesn't lock you out. It also skips the Twitch redirect."
              : "Add an authenticator app so a lost passkey doesn't lock you out."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4" /> Authenticator app
            </CardTitle>
            <CardDescription>A 6-digit code after each Twitch sign-in. One app per account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {totp ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{totp.friendlyName}</p>
                  <p className="text-xs text-muted-foreground">Added {formatDate(totp.createdAt)}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove authenticator" disabled={busyId === totp.id}>
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove the authenticator app?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {passkeys.length > 0
                          ? "Twitch sign-in will no longer work on its own; you'll sign in with a passkey. You can add a new authenticator any time."
                          : "You can't remove your only second factor. Add a passkey first."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      {passkeys.length > 0 && <AlertDialogAction onClick={() => void removeTotp()}>Remove</AlertDialogAction>}
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : addingTotp ? (
              <TotpEnroll
                onVerified={() => {
                  toast.success("Authenticator app connected.");
                  setAddingTotp(false);
                  router.refresh();
                }}
              />
            ) : (
              <Button variant="outline" onClick={() => setAddingTotp(true)}>
                Set up authenticator
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Passkeys
            </CardTitle>
            <CardDescription>Sign in with Face ID, Touch ID or a security key. Add one per device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passkeys.length > 0 && (
              <ul className="space-y-2">
                {passkeys.map((p) => (
                  <PasskeyRow
                    key={p.id}
                    passkey={p}
                    busy={busyId === p.id}
                    canRemove={methodCount > 1}
                    onRemove={() => void removePasskey(p.id)}
                    onRenamed={() => router.refresh()}
                  />
                ))}
              </ul>
            )}

            {addingPasskey ? (
              <PasskeyRegister
                compact
                onRegistered={() => {
                  toast.success("Passkey saved.");
                  setAddingPasskey(false);
                  router.refresh();
                }}
              />
            ) : (
              <Button variant="outline" onClick={() => setAddingPasskey(true)}>
                Add a passkey
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PasskeyRow({
  passkey,
  busy,
  canRemove,
  onRemove,
  onRenamed,
}: {
  passkey: PasskeyView;
  busy: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(passkey.friendlyName);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const friendlyName = name.trim().slice(0, 120);
    if (!friendlyName || friendlyName === passkey.friendlyName) return setEditing(false);
    setSaving(true);
    const { error } = await supabase.auth.passkey.update({ passkeyId: passkey.id, friendlyName });
    setSaving(false);
    if (error) return void toast.error(error.message);
    setEditing(false);
    onRenamed();
  };

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-8" autoFocus />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name" disabled={saving}>
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Cancel"
              onClick={() => {
                setName(passkey.friendlyName);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{passkey.friendlyName}</p>
            <p className="text-xs text-muted-foreground">
              Added {formatDate(passkey.createdAt)} · last used {formatDate(passkey.lastUsedAt)}
            </p>
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Rename passkey" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Remove passkey" disabled={busy}>
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove &ldquo;{passkey.friendlyName}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  {canRemove
                    ? "This passkey will stop working for the admin dashboard. Delete it from your device's password manager as well."
                    : "You can't remove your only second factor. Add an authenticator app or another passkey first."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                {canRemove && <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </li>
  );
}
