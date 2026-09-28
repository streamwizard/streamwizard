import Link from "next/link";
import { missingTwitchScopes } from "@repo/schemas";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAdminUserUsage, listUserActivity } from "@repo/supabase/queries/admin-users";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { ActivityList } from "@/components/users/activity-list";
import { BanUserDialog, DeleteUserDialog, RemoveFactorButton } from "@/components/users/moderation";
import { AdminRoleToggle } from "@/components/users/user-actions";
import { assertAdmin } from "@/lib/assert-admin";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { loadUserAuthState } from "@/lib/user-auth";
import { formatBytes, isPast, loadAdminUser, userDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function When({ iso, empty = "Never" }: { iso: string | null; empty?: string }) {
  if (!iso) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelativeTime(iso)}
    </time>
  );
}

function Scopes({ label, missing }: { label: string; missing: string[] }) {
  return (
    <Row label={label}>
      {missing.length === 0 ? (
        <span className="text-emerald-600 dark:text-emerald-400">All granted</span>
      ) : (
        <span className="flex flex-wrap justify-end gap-1">
          {missing.map((scope) => (
            <Badge key={scope} variant="outline" className="font-mono text-xs text-amber-700 dark:text-amber-400">
              {scope}
            </Badge>
          ))}
        </span>
      )}
    </Row>
  );
}

export default async function UserOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [adminId, user] = await Promise.all([assertAdmin(), loadAdminUser(id)]);
  const [usage, activity, auth] = await Promise.all([
    getAdminUserUsage(supabaseAdmin, user.id),
    listUserActivity(supabaseAdmin, "platform", { userId: user.id, twitchUserId: user.twitch?.userId ?? null }, 1, 5),
    loadUserAuthState(user.id),
  ]);
  const isSelf = adminId === user.id;
  const isAdmin = user.roles.includes("admin");
  const name = userDisplayName(user);
  const tokenExpired = isPast(user.twitch?.tokenExpiresAt ?? null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Twitch</CardTitle>
        </CardHeader>
        <CardContent>
          {user.twitch ? (
            <dl className="divide-y">
              <Row label="Channel">{user.twitch.username}</Row>
              <Row label="Linked">
                <When iso={user.twitch.linkedAt} />
              </Row>
              <Row label="Token">
                {!user.twitch.hasToken ? (
                  <span className="text-red-600 dark:text-red-400">None stored</span>
                ) : tokenExpired ? (
                  <span title="Refreshes on next use">Expired, refreshes on use</span>
                ) : (
                  <span>
                    Expires <When iso={user.twitch.tokenExpiresAt} empty="unknown" />
                  </span>
                )}
              </Row>
              <Row label="Scopes checked">
                <When iso={user.twitch.scopesSyncedAt} empty="Not yet" />
              </Row>
              {user.twitch.scopes === null ? (
                <Row label="Scopes">
                  <span className="text-muted-foreground">Unknown until the hourly check runs</span>
                </Row>
              ) : (
                <>
                  <Scopes label="Missing (base)" missing={missingTwitchScopes(user.twitch.scopes, "base")} />
                  <Scopes label="Missing (Cloud OBS)" missing={missingTwitchScopes(user.twitch.scopes, "cloud_obs")} />
                </>
              )}
              {user.live && (
                <Row label="Last stream">
                  {user.live.isLive ? (
                    <span>
                      Live now{user.live.category ? ` · ${user.live.category}` : ""}
                    </span>
                  ) : (
                    <When iso={user.live.endedAt ?? user.live.startedAt} />
                  )}
                </Row>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No Twitch account linked. EventSub and clips need one.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Account</CardTitle>
          <AdminRoleToggle userId={user.id} name={name} isAdmin={isAdmin} isSelf={isSelf} />
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Roles">{user.roles.length ? user.roles.join(", ") : <span className="text-muted-foreground">None</span>}</Row>
            <Row label="Onboarding">
              {user.preferences?.onboardingCompleted ? "Done" : <span className="text-muted-foreground">Not finished</span>}
            </Row>
            <Row label="Discord">
              {user.discord ? (
                <Link href={`/users/${user.id}/discord`} className="hover:underline">
                  {user.discord.username}
                </Link>
              ) : (
                <span className="text-muted-foreground">Not linked</span>
              )}
            </Row>
            <Row label="Go-live posts">{user.preferences?.discordLiveNotifications ? "On" : "Off"}</Row>
            <Row label="Clip sync after stream">{user.preferences?.syncClipsOnEnd ? "On" : "Off"}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Cloud OBS instances">
              {usage.obsInstances.length ? (
                <span className="flex flex-col items-end gap-0.5">
                  {usage.obsInstances.map((instance) => (
                    <span key={instance.id} className="text-xs">
                      {instance.resolution} · {instance.status}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label="Overlay scenes">{usage.overlayScenes}</Row>
            <Row label="Clips">{usage.clips}</Row>
            <Row label="Last clip sync">
              {usage.clipSync ? (
                <span className={usage.clipSync.lastError ? "text-red-600 dark:text-red-400" : undefined} title={usage.clipSync.lastError ?? undefined}>
                  {usage.clipSync.status} · <When iso={usage.clipSync.lastSync} />
                </span>
              ) : (
                <span className="text-muted-foreground">Never</span>
              )}
            </Row>
            <Row label="Media storage">{formatBytes(usage.storageBytes)}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/users/${user.id}/activity`}>See all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activity.rows.length ? (
            <ActivityList rows={activity.rows} />
          ) : (
            <p className="text-sm text-muted-foreground">No platform events for this user yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign-in and security</CardTitle>
        </CardHeader>
        <CardContent>
          {!auth ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t read their auth record.</p>
          ) : (
            <dl className="divide-y">
              <Row label="Last sign-in">
                <When iso={auth.lastSignInAt} />
              </Row>
              <Row label="Sign-in methods">{auth.providers.length ? auth.providers.join(", ") : <span className="text-muted-foreground">None</span>}</Row>
              <Row label="Authenticator apps">
                {auth.totpFactors.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <span className="flex flex-col items-end gap-1">
                    {auth.totpFactors.map((factor) => (
                      <span key={factor.id} className="flex items-center gap-1">
                        <span>
                          {factor.friendly_name || "Authenticator"}
                          {factor.status !== "verified" && <span className="text-muted-foreground"> (not finished)</span>}
                        </span>
                        {!isSelf && (
                          <RemoveFactorButton userId={user.id} kind="totp" id={factor.id} label={factor.friendly_name || "this authenticator"} />
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </Row>
              <Row label="Passkeys">
                {auth.passkeys.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <span className="flex flex-col items-end gap-1">
                    {auth.passkeys.map((passkey) => (
                      <span key={passkey.id} className="flex items-center gap-1">
                        <span title={passkey.last_used_at ? `Last used ${formatDateTime(passkey.last_used_at)}` : "Never used"}>
                          {passkey.friendly_name || "Passkey"}
                        </span>
                        {!isSelf && (
                          <RemoveFactorButton userId={user.id} kind="passkey" id={passkey.id} label={passkey.friendly_name || "this passkey"} />
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </Row>
            </dl>
          )}
          {isSelf && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your own factors live on the{" "}
              <Link href="/security" className="underline">
                Security page
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSelf ? (
            <p className="text-sm text-muted-foreground">You can&apos;t ban or delete your own account from here.</p>
          ) : isAdmin ? (
            <p className="text-sm text-muted-foreground">Remove their admin role first. Admins can&apos;t be banned or deleted.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ban keeps their data and can be lifted. Delete removes the account and everything in it for good.
              </p>
              <div className="flex flex-wrap gap-2">
                {!auth?.bannedUntil && (
                  <BanUserDialog userId={user.id} name={name} hasDiscord={!!user.discord} hasTwitch={!!user.twitch} />
                )}
                <DeleteUserDialog userId={user.id} name={name} hasDiscord={!!user.discord} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
