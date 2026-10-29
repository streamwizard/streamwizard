import { ShieldCheck, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export type TotpFactorView = { id: string; friendlyName: string; createdAt: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The admin's authenticator app. It is the only second factor (passkeys were
 * removed in SW-483), so it can't be removed from here: that would lock the
 * account. Another admin can reset it from the user's page instead.
 */
export function SecuritySettings({ totp }: { totp: TotpFactorView | null }) {
  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck />
        <AlertTitle>Twitch plus an authenticator app</AlertTitle>
        <AlertDescription>
          Every sign-in needs a code from your authenticator app after Twitch. Lost your phone? Ask another admin to reset
          your authenticator on your user page, then set up a new one at your next sign-in.
        </AlertDescription>
      </Alert>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" /> Authenticator app
          </CardTitle>
          <CardDescription>A 6-digit code after each Twitch sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          {totp ? (
            <div className="rounded-md border border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{totp.friendlyName}</p>
              <p className="text-xs text-muted-foreground">Added {formatDate(totp.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No authenticator connected.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
