import type { TicketTag } from "@repo/supabase/queries/ticket-tags";

// Which tags a message triggers. Plain substring matching on lowercased
// text, never a regex built from what an admin typed: no ReDoS, no surprises
// from a stray "(" in a keyword.

/** Tags whose keywords occur in `content`, in tag order. Only tags with auto-reply on. */
export function matchTags<T extends Pick<TicketTag, "auto_reply" | "trigger_keywords">>(tags: readonly T[], content: string): T[] {
  const haystack = content.toLowerCase();
  if (!haystack.trim()) return [];
  return tags.filter(
    (tag) =>
      tag.auto_reply &&
      tag.trigger_keywords.some((keyword) => {
        const needle = keyword.trim().toLowerCase();
        return needle.length > 0 && haystack.includes(needle);
      }),
  );
}

/** Tags named like `typed`, for the /tag autocomplete. */
export function searchTags<T extends Pick<TicketTag, "name">>(tags: readonly T[], typed: string, limit = 25): T[] {
  const needle = typed.trim().toLowerCase();
  return tags.filter((tag) => tag.name.includes(needle)).slice(0, limit);
}
