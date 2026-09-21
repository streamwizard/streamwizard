import { ANNOUNCEMENT_VARIABLES, type Announcement, type ValidateAnnouncementOptions } from "@repo/discord-message";
import type { ChannelKind } from "./channel-kind";

// What the Announcements pages share. Safe to import from client components: data only.

/** Where an announcement can go. */
export const ANNOUNCEMENT_CHANNEL_KINDS: ChannelKind[] = ["text", "announcement"];

/** The same checks the editor shows, for the Post button and the actions. */
export const ANNOUNCEMENT_VALIDATE_OPTIONS: ValidateAnnouncementOptions = {
  allowedVariables: ANNOUNCEMENT_VARIABLES.map((v) => v.key),
};

/** A schedule this far in the past still counts: the clock on the admin's machine may lag. */
export const SCHEDULE_GRACE_MS = 60_000;

export type AnnouncementStatus = "draft" | "scheduled" | "posting" | "posted" | "changed" | "failed";

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  posting: "Posting…",
  posted: "Posted",
  changed: "Unposted changes",
  failed: "Failed",
};

/** Changed: what's in Discord is older than what's saved here. */
export function announcementStatus(row: {
  status: string;
  draft: Announcement | null;
  posted: Announcement | null;
}): AnnouncementStatus {
  switch (row.status) {
    case "scheduled":
    case "posting":
    case "failed":
      return row.status;
    case "posted":
      return row.posted && JSON.stringify(row.posted) === JSON.stringify(row.draft) ? "posted" : "changed";
    default:
      return "draft";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO time as a `datetime-local` value in the browser's own zone. Never `toISOString().slice`: that is UTC. */
export function toLocalInputValue(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value (local wall time) as ISO, or null when it isn't a time. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The mention picker's options, in the words the form uses. */
export const MENTION_OPTIONS = [
  { value: "none", label: "Nobody" },
  { value: "everyone", label: "Everyone (@everyone)" },
  { value: "here", label: "Everyone online (@here)" },
  { value: "role", label: "A role" },
] as const;
