"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { grantSubscriptionAction, revokeSubscriptionAction, updateSubscriptionAction } from "@/actions/subscriptions";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/widgets/responsive-dialog";
import type { ProductWithPlans, SubscriptionRow, UserRow } from "./types";

/** Grant a product to a user, edit an existing grant, and revoke one. All three
 *  are admin-only writes that bypass Stripe entirely. Used from the users list
 *  (row menu) and from a user's page (Actions menu, Plans tab). */

// The trigger's own data-[size] height outranks a plain h-10, so the phone size is set on the same variant.
const SELECT_TRIGGER = "w-full text-base data-[size=default]:h-11 md:text-sm md:data-[size=default]:h-9";
// Primary button on top in the phone drawer, like the desktop footer puts it last.
const FOOTER = "max-md:flex-col-reverse";

/** Opened by whoever owns `open`: a menu item or a button elsewhere on the page. */
export function GrantDialog({
  user,
  products,
  open,
  onOpenChange,
  onGranted,
}: {
  user: UserRow;
  products: ProductWithPlans[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted: () => void;
}) {
  const id = useId();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<"active" | "trialing">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const plans = products.find((p) => p.id === productId)?.plans ?? [];

  const handleProductChange = (val: string) => {
    setProductId(val);
    setPlanId("");
  };

  const handleSubmit = () => {
    if (!planId) {
      toast.error("Select a plan first.");
      return;
    }
    startTransition(async () => {
      const result = await grantSubscriptionAction(user.id, planId, status, expiresAt || null, note || null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Access granted to ${user.name}`);
      onGranted();
      onOpenChange(false);
      setPlanId("");
      setNote("");
      setExpiresAt("");
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[420px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Grant access to {user.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Starts right away and replaces any plan they have for the same product. Stripe isn&apos;t involved.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no products to grant yet.</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-product`}>Product</Label>
              <Select value={productId} onValueChange={handleProductChange}>
                <SelectTrigger id={`${id}-product`} className={SELECT_TRIGGER}>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-plan`}>Plan</Label>
              <Select value={planId} onValueChange={setPlanId} disabled={plans.length === 0}>
                <SelectTrigger id={`${id}-plan`} className={SELECT_TRIGGER}>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-status`}>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trialing")}>
                <SelectTrigger id={`${id}-status`} className={SELECT_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-expires`}>
                Expiry date <span className="text-xs text-muted-foreground">(leave empty for permanent)</span>
              </Label>
              <Input id={`${id}-expires`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-11 md:h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-note`}>
                Note <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${id}-note`}
                placeholder="e.g. 1 month trial, permanent beta access"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-11 md:h-9"
              />
            </div>
          </div>
        )}
        <ResponsiveDialogFooter className={FOOTER}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !planId}>
            {isPending ? "Granting…" : "Grant access"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function EditDialog({ subscription, onUpdated }: { subscription: SubscriptionRow; onUpdated: () => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"active" | "trialing" | "past_due">(subscription.status as "active" | "trialing" | "past_due");
  const [expiresAt, setExpiresAt] = useState(subscription.current_period_end ? subscription.current_period_end.slice(0, 10) : "");
  const [note, setNote] = useState(subscription.grant_note ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateSubscriptionAction(subscription.id, {
        status,
        expiresAt: expiresAt || null,
        note: note || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan updated.");
      onUpdated();
      setOpen(false);
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-11 md:h-8">
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[380px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            Edit {subscription.plan.product.name} · {subscription.plan.name}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Change the status, the end date or the note. The plan itself stays the same.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-status`}>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trialing" | "past_due")}>
              <SelectTrigger id={`${id}-status`} className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-expires`}>
              Expiry date <span className="text-xs text-muted-foreground">(leave empty for permanent)</span>
            </Label>
            <Input id={`${id}-expires`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-11 md:h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`}>
              Note <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`${id}-note`}
              placeholder="e.g. 1 month trial"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 md:h-9"
            />
          </div>
        </div>
        <ResponsiveDialogFooter className={FOOTER}>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** Cancels one plan after a confirm. A plain confirmation, so it stays an AlertDialog on phones too. */
export function RevokeDialog({
  subscription,
  userName,
  billedByStripe,
  onRevoked,
}: {
  subscription: SubscriptionRow;
  userName: string;
  /** A Stripe subscription keeps billing after a revoke here; the dialog says so. */
  billedByStripe?: boolean;
  onRevoked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const revoke = (event: React.MouseEvent) => {
    // Stay open until the action answers, so a failure isn't hidden behind a closed dialog.
    event.preventDefault();
    startTransition(async () => {
      const result = await revokeSubscriptionAction(subscription.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Access revoked.");
      onRevoked();
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-11 text-destructive hover:text-destructive md:h-8">
          <Trash2 className="size-3.5" aria-hidden />
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke access?</AlertDialogTitle>
          <AlertDialogDescription>
            This cancels {userName}&apos;s{" "}
            <strong>
              {subscription.plan.product.name} · {subscription.plan.name}
            </strong>{" "}
            right away. They lose access on their next page load.
            {billedByStripe && " Stripe keeps billing until it's canceled there too."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={revoke} disabled={isPending}>
            {isPending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
