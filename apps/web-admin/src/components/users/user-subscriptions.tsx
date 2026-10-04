"use client";

import { useRouter } from "next/navigation";
import type { AdminUserSubscription } from "@repo/supabase/queries/admin-users";
import { Badge, Card, CardContent } from "@repo/ui";
import { EditDialog, RevokeDialog } from "@/components/subscriptions/subscription-dialogs";
import type { SubscriptionRow, UserRow } from "@/components/subscriptions/types";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { SectionHeading } from "@/components/widgets/section-heading";
import { LIVE_PLAN_STATUSES, PLAN_STATUS_LABELS, planStatusVariant } from "@/lib/users";
import { GrantAccessButton } from "./grant-access";

// DataList is a container: these follow the list's own width, like its table/card switch at @2xl.
const WIDE_ONLY = "hidden @4xl:table-cell";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function toRow(userId: string, sub: AdminUserSubscription): SubscriptionRow {
  return {
    id: sub.id,
    user_id: userId,
    status: sub.status,
    current_period_end: sub.currentPeriodEnd,
    grant_note: sub.grantNote,
    plan: sub.plan,
  };
}

/** One user's plans, live first then history. Needs a GrantAccessProvider above it (the user layout has one). */
export function UserSubscriptions({
  user,
  subscriptions,
  granters,
}: {
  user: UserRow;
  subscriptions: AdminUserSubscription[];
  /** Admin user id to display name, for "granted by". */
  granters: Record<string, string>;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const live = subscriptions.filter((sub) => LIVE_PLAN_STATUSES.has(sub.status));
  const past = subscriptions.filter((sub) => !LIVE_PLAN_STATUSES.has(sub.status));

  const source = (sub: AdminUserSubscription) =>
    sub.grantedBy ? (
      <span>Granted by {granters[sub.grantedBy] ?? "an admin"}</span>
    ) : sub.stripeSubscriptionId ? (
      // The id is in view, not in a title: it's what you search for in Stripe.
      <span>
        Stripe <span className="block font-mono text-xs break-all text-muted-foreground">{sub.stripeSubscriptionId}</span>
      </span>
    ) : (
      <span className="text-muted-foreground">Unknown</span>
    );

  const columns: DataColumn<AdminUserSubscription>[] = [
    {
      key: "plan",
      header: "Plan",
      mobile: "title",
      className: "whitespace-normal",
      cell: (sub) => (
        <>
          <span className="block font-medium">
            {sub.plan.product.name} · {sub.plan.name}
          </span>
          {sub.grantNote && <span className="block text-xs font-normal text-muted-foreground italic">{sub.grantNote}</span>}
          {/* In the narrow table the Source column is gone, so it rides under the plan. */}
          <span className="hidden text-xs font-normal text-muted-foreground @2xl:block @4xl:hidden">{source(sub)}</span>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (sub) => (
        <Badge variant={planStatusVariant(sub.status)} className="text-xs">
          {PLAN_STATUS_LABELS[sub.status] ?? sub.status}
        </Badge>
      ),
    },
    // Source and Updated leave the table while the list is under 896px wide; the two buttons need the room.
    { key: "source", header: "Source", headClassName: WIDE_ONLY, className: `${WIDE_ONLY} whitespace-normal`, cell: source },
    {
      key: "until",
      header: "Until",
      className: "whitespace-nowrap",
      cell: (sub) => (sub.currentPeriodEnd ? date(sub.currentPeriodEnd) : <span className="text-muted-foreground">No end</span>),
    },
    {
      key: "updated",
      header: "Updated",
      headClassName: WIDE_ONLY,
      className: `${WIDE_ONLY} whitespace-nowrap text-muted-foreground`,
      cell: (sub) => date(sub.updatedAt),
    },
  ];

  const list = (rows: AdminUserSubscription[], editable: boolean) => (
    <Card className="py-0">
      <CardContent className="px-0 sm:px-2">
        <DataList
          rows={rows}
          rowKey={(sub) => sub.id}
          columns={columns}
          actions={
            editable
              ? (sub) => (
                  // Wraps, so on a narrow table the two buttons stack instead of pushing the table wider.
                  <div className="flex flex-wrap gap-2 @2xl:justify-end">
                    <EditDialog subscription={toRow(user.id, sub)} onUpdated={refresh} />
                    <RevokeDialog
                      subscription={toRow(user.id, sub)}
                      userName={user.name}
                      billedByStripe={!sub.grantedBy && !!sub.stripeSubscriptionId}
                      onRevoked={refresh}
                    />
                  </div>
                )
              : undefined
          }
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading>Current plans</SectionHeading>
          <GrantAccessButton user={user} />
        </div>
        {live.length ? list(live, true) : <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No plan right now.</p>}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <SectionHeading>History</SectionHeading>
          {list(past, false)}
        </section>
      )}
    </div>
  );
}
