import { cache } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAdminUser, type AdminUserDetail } from "@repo/supabase/queries/admin-users";

// Server-only. The /users/[id] layout and each tab read the same user; cache()
// makes that one query per request.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const loadAdminUser = cache(async (id: string): Promise<AdminUserDetail> => {
  if (!UUID.test(id)) notFound();
  const user = await getAdminUser(supabaseAdmin, id);
  if (!user) notFound();
  return user;
});

/** Twitch username first, then the account name unless it's the email fallback. */
export function userDisplayName(user: { name: string; email: string; twitch: { username: string } | null }): string {
  if (user.twitch) return user.twitch.username;
  const name = user.name?.trim();
  return name && !name.includes("@") ? name : user.email;
}

export function userAvatarUrl(user: { avatarUrl: string | null; twitch: { profileImageUrl: string | null } | null }): string | null {
  return user.twitch?.profileImageUrl ?? user.avatarUrl ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Whether an ISO time has passed. Null is never past. */
export function isPast(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now();
}

export const LIVE_PLAN_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "past_due") return "destructive";
  return "outline";
}

export const PLAN_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  inactive: "Inactive",
};
