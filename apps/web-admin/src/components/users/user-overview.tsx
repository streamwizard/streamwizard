import Link from "next/link";
import { missingTwitchScopes } from "@repo/schemas";
import type { AdminUserDetail, AdminUserUsage, UserActivityRow } from "@repo/supabase/queries/admin-users";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { formatDateTime } from "@/lib/discord/tickets";
import type { UserAuthState } from "@/lib/user-auth";
import { LIVE_PLAN_STATUSES, PLAN_STATUS_LABELS, formatBytes, isPast, planStatusVariant, userAvatarUrl, userDisplayName } from "@/lib/users";
import { ActivityList } from "./activity-list";
import { Row, When } from "./detail";
import { GrantAccessButton } from "./grant-access";
import { RemoveFactorButton } from "./moderation";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Scopes({ label, missing }: { label: string; missing: string[] }) {
  return (
    <Row label={label}>
      {missing.length === 0 ? (
        <span className="text-emerald-600 dark:text-emerald-400">All granted</span>
      ) : (
        <span className="flex flex-wrap justify-end gap-1">
          {missing.map((scope) => (
            // Long scope names wrap inside the badge instead of pushing the card wider on a phone.
            <Badge key={scope} variant="outline" className="h-auto shrink font-mono text-xs break-all whitespace-normal text-amber-700 dark:text-amber-400">
              {scope}
            </Badge>
          ))}
        </span>
      )}
    </Row>
  );
}

/**
 * The Overview tab, in the order support needs it: who they are, what they
 * pay for, their Twitch link, then history and housekeeping. Actions on the
 * account live in the header's Actions menu. Needs a GrantAccessProvider above.
 */
export function UserOverview({
  user,
  usage,
  activity,
  auth,
  isSelf,
}: {
  user: AdminUserDetail;
  usage: AdminUserUsage;
  /** The latest few platform events. */
  activity: UserActivityRow[];
  auth: UserAuthState | null;
  isSelf: boolean;
}) {
  const name = userDisplayName(user);
  const tokenExpired = isPast(user.twitch?.tokenExpiresAt ?? null);
  const livePlans = user.subscriptions.filter((sub) => LIVE_PLAN_STATUSES.has(sub.status));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Joined">{formatDateTime(user.createdAt)}</Row>
            <Row label="Roles">{user.roles.length ? user.roles.join(", ") : <span className="text-muted-foreground">None</span>}</Row>
            <Row label="Onboarding">
              {user.preferences?.onboardingCompleted ? "Done" : <span className="text-muted-foreground">Not finished</span>}
            </Row>
            <Row label="Discord">
              {user.discord ? (
                <Link href={`/users/${user.id}/discord`} className="underline underline-offset-4">
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Plans</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
              <Link href={`/users/${user.id}/subscriptions`}>See all</Link>
            </Button>
            <GrantAccessButton user={{ id: user.id, name, email: user.email, avatar_url: userAvatarUrl(user) }} />
          </div>
        </CardHeader>
        <CardContent>
          {livePlans.length ? (
            <ul className="divide-y">
              {livePlans.map((sub) => (
                <li key={sub.id} className="flex items-start justify-between gap-4 py-1.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {sub.plan.product.name} · {sub.plan.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {sub.currentPeriodEnd ? `Until ${date(sub.currentPeriodEnd)}` : "No end date"}
                    </span>
                  </span>
                  <Badge variant={planStatusVariant(sub.status)} className="text-xs">
                    {PLAN_STATUS_LABELS[sub.status] ?? sub.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No plan right now.</p>
          )}
        </CardContent>
      </Card>

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
                  <span>Expired, refreshes on use</span>
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
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
            <Link href={`/users/${user.id}/activity`}>See all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activity.length ? <ActivityList rows={activity} /> : <p className="text-sm text-muted-foreground">No platform events for this user yet.</p>}
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
                <span className={usage.clipSync.lastError ? "text-red-600 dark:text-red-400" : undefined}>
                  {usage.clipSync.status} · <When iso={usage.clipSync.lastSync} />
                  {/* In view, not in a title: the error is the reason to look at this row. */}
                  {usage.clipSync.lastError && <span className="mt-0.5 block text-xs">{usage.clipSync.lastError}</span>}
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
                        <span>
                          {passkey.friendly_name || "Passkey"}
                          <span className="block text-xs text-muted-foreground">
                            {passkey.last_used_at ? `Last used ${formatDateTime(passkey.last_used_at)}` : "Never used"}
                          </span>
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
    </div>
  );
}
