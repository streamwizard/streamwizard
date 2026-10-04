"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@repo/ui";
import { GrantDialog } from "@/components/subscriptions/subscription-dialogs";
import type { ProductWithPlans, UserRow } from "@/components/subscriptions/types";
import { cn } from "@/lib/utils";

const GrantAccessContext = createContext<((user: UserRow) => void) | null>(null);

/**
 * Owns the one Grant access dialog for everything below it. The users list
 * wraps its rows in it, a user's page wraps its header and tabs, so a row
 * menu, the Actions menu and the Plans tab all open the same dialog and the
 * plan catalog is loaded once.
 */
export function GrantAccessProvider({ products, children }: { products: ProductWithPlans[]; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);

  const grant = useCallback((target: UserRow) => {
    setUser(target);
    setOpen(true);
  }, []);

  return (
    <GrantAccessContext.Provider value={grant}>
      {children}
      {/* Keyed by user so the form starts clean for each person. */}
      {user && <GrantDialog key={user.id} user={user} products={products} open={open} onOpenChange={setOpen} onGranted={() => router.refresh()} />}
    </GrantAccessContext.Provider>
  );
}

export function useGrantAccess(): (user: UserRow) => void {
  const grant = useContext(GrantAccessContext);
  if (!grant) throw new Error("useGrantAccess needs a GrantAccessProvider above it");
  return grant;
}

export function GrantAccessButton({ user, className }: { user: UserRow; className?: string }) {
  const grant = useGrantAccess();
  return (
    <Button size="sm" variant="outline" className={cn("h-11 md:h-8", className)} onClick={() => grant(user)}>
      <Plus className="size-3.5" aria-hidden />
      Grant access
    </Button>
  );
}
