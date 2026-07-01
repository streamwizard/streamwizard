"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import {
  grantSubscriptionAction,
  revokeSubscriptionAction,
  updateSubscriptionAction,
} from "@/actions/subscriptions";

export type ProductWithPlans = {
  id: string;
  name: string;
  plans: { id: string; name: string }[];
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  current_period_end: string | null;
  grant_note: string | null;
  plan: { id: string; name: string; product: { id: string; name: string } };
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};

interface Props {
  users: UserRow[];
  subscriptions: SubscriptionRow[];
  products: ProductWithPlans[];
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "past_due") return "destructive";
  return "outline";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function GrantDialog({
  user,
  products,
  onGranted,
}: {
  user: UserRow;
  products: ProductWithPlans[];
  onGranted: (sub: SubscriptionRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<"active" | "trialing">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId);
  const plans = selectedProduct?.plans ?? [];

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
      const result = await grantSubscriptionAction(
        user.id,
        planId,
        status,
        expiresAt || null,
        note || null
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Access granted to ${user.name}`);
      const product = products.find((p) => p.id === productId)!;
      const plan = product.plans.find((p) => p.id === planId)!;
      onGranted({
        id: crypto.randomUUID(),
        user_id: user.id,
        status,
        current_period_end: expiresAt || null,
        grant_note: note || null,
        plan: { id: plan.id, name: plan.name, product: { id: product.id, name: product.name } },
      });
      setOpen(false);
      setPlanId("");
      setNote("");
      setExpiresAt("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Grant access — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger>
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
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={plans.length === 0}>
              <SelectTrigger>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trialing")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date <span className="text-muted-foreground text-xs">(leave empty for permanent)</span></Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. 1 month trial, permanent beta access"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !planId}>
            {isPending ? "Granting…" : "Grant access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  subscription,
  onUpdated,
}: {
  subscription: SubscriptionRow;
  onUpdated: (updated: Partial<SubscriptionRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"active" | "trialing" | "past_due">(
    subscription.status as "active" | "trialing" | "past_due"
  );
  const [expiresAt, setExpiresAt] = useState(
    subscription.current_period_end
      ? subscription.current_period_end.slice(0, 10)
      : ""
  );
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
      toast.success("Subscription updated.");
      onUpdated({ status, current_period_end: expiresAt || null, grant_note: note || null });
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Edit — {subscription.plan.product.name} / {subscription.plan.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "trialing" | "past_due")}
            >
              <SelectTrigger>
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
            <Label>Expiry date <span className="text-muted-foreground text-xs">(leave empty for permanent)</span></Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. 1 month trial"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionsClient({ users, subscriptions: initialSubs, products }: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialSubs);
  const [search, setSearch] = useState("");

  const subsByUser = useMemo(() => {
    const map = new Map<string, SubscriptionRow[]>();
    for (const sub of subscriptions) {
      const list = map.get(sub.user_id) ?? [];
      list.push(sub);
      map.set(sub.user_id, list);
    }
    return map;
  }, [subscriptions]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleGranted = (userId: string, sub: SubscriptionRow) => {
    setSubscriptions((prev) => {
      // Replace any existing sub for the same product (we canceled it server-side)
      const filtered = prev.filter(
        (s) => !(s.user_id === userId && s.plan.product.id === sub.plan.product.id)
      );
      return [...filtered, sub];
    });
  };

  const handleRevoke = (subscriptionId: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId));
  };

  const handleUpdated = (subscriptionId: string, updates: Partial<SubscriptionRow>) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subscriptionId ? { ...s, ...updates } : s))
    );
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Active subscriptions</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {filteredUsers.map((user) => {
              const userSubs = subsByUser.get(user.id) ?? [];
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {userSubs.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No subscriptions</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-1 rounded-md border px-2 py-1"
                          >
                            <div className="flex flex-col leading-tight mr-1">
                              <span className="text-xs font-medium">
                                {sub.plan.product.name} — {sub.plan.name}
                              </span>
                              {sub.current_period_end && (
                                <span className="text-xs text-muted-foreground">
                                  until {new Date(sub.current_period_end).toLocaleDateString()}
                                </span>
                              )}
                              {sub.grant_note && (
                                <span className="text-xs text-muted-foreground italic">
                                  {sub.grant_note}
                                </span>
                              )}
                            </div>
                            <Badge variant={statusVariant(sub.status)} className="text-xs h-5">
                              {sub.status.replace("_", " ")}
                            </Badge>
                            <EditDialog
                              subscription={sub}
                              onUpdated={(updates) => handleUpdated(sub.id, updates)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel {user.name}&apos;s{" "}
                                    <strong>
                                      {sub.plan.product.name} — {sub.plan.name}
                                    </strong>{" "}
                                    subscription immediately. They will lose access on next page load.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      const result = await revokeSubscriptionAction(sub.id);
                                      if (result.error) {
                                        toast.error(result.error);
                                        return;
                                      }
                                      toast.success("Access revoked.");
                                      handleRevoke(sub.id);
                                    }}
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <GrantDialog
                      user={user}
                      products={products}
                      onGranted={(sub) => handleGranted(user.id, sub)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
