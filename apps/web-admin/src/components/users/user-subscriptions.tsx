"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { AdminUserSubscription } from "@repo/supabase/queries/admin-users";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { revokeSubscriptionAction } from "@/actions/subscriptions";
import { EditDialog, GrantDialog } from "@/components/subscriptions/subscription-dialogs";
import type { ProductWithPlans, SubscriptionRow, UserRow } from "@/components/subscriptions/types";
import { LIVE_PLAN_STATUSES, PLAN_STATUS_LABELS, planStatusVariant } from "@/lib/users";

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

/** One user's plans, live first then history. Grants and edits reuse the /subscriptions dialogs. */
export function UserSubscriptions({
  user,
  subscriptions,
  products,
  granters,
}: {
  user: UserRow;
  subscriptions: AdminUserSubscription[];
  products: ProductWithPlans[];
  /** Admin user id to display name, for "granted by". */
  granters: Record<string, string>;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const live = subscriptions.filter((sub) => LIVE_PLAN_STATUSES.has(sub.status));
  const past = subscriptions.filter((sub) => !LIVE_PLAN_STATUSES.has(sub.status));

  const revoke = async (sub: AdminUserSubscription) => {
    const result = await revokeSubscriptionAction(sub.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Access revoked.");
    refresh();
  };

  const table = (rows: AdminUserSubscription[], editable: boolean) => (
    <Card className="py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 text-xs text-muted-foreground">Plan</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs text-muted-foreground">Source</TableHead>
              <TableHead className="text-xs text-muted-foreground">Until</TableHead>
              <TableHead className="text-xs text-muted-foreground">Updated</TableHead>
              {editable && <TableHead className="w-24 pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="py-2.5 pl-4">
                  <div className="font-medium">
                    {sub.plan.product.name} · {sub.plan.name}
                  </div>
                  {sub.grantNote && <div className="text-xs text-muted-foreground italic">{sub.grantNote}</div>}
                </TableCell>
                <TableCell className="py-2.5">
                  <Badge variant={planStatusVariant(sub.status)} className="text-xs">
                    {PLAN_STATUS_LABELS[sub.status] ?? sub.status}
                  </Badge>
                </TableCell>
                <TableCell className="py-2.5 text-sm">
                  {sub.grantedBy ? (
                    <span>Granted by {granters[sub.grantedBy] ?? "an admin"}</span>
                  ) : sub.stripeSubscriptionId ? (
                    <span title={sub.stripeSubscriptionId}>Stripe</span>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 text-sm">
                  {sub.currentPeriodEnd ? date(sub.currentPeriodEnd) : <span className="text-muted-foreground">No end</span>}
                </TableCell>
                <TableCell className="py-2.5 text-sm text-muted-foreground">{date(sub.updatedAt)}</TableCell>
                {editable && (
                  <TableCell className="py-2.5 pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      <EditDialog subscription={toRow(user.id, sub)} onUpdated={refresh} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Revoke">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cancels {user.name}&apos;s{" "}
                              <strong>
                                {sub.plan.product.name} · {sub.plan.name}
                              </strong>{" "}
                              right away. They lose access on their next page load.
                              {!sub.grantedBy && sub.stripeSubscriptionId && " Stripe keeps billing until it's canceled there too."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revoke(sub)}>Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Current plans</h2>
          <GrantDialog user={user} products={products} onGranted={refresh} />
        </div>
        {live.length ? table(live, true) : <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No plan right now.</p>}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">History</h2>
          {table(past, false)}
        </section>
      )}
    </div>
  );
}
