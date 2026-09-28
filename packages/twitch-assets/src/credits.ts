import { supabase } from "@repo/supabase";
import {
  selectCreditsEventRows,
  selectCreditsStream,
  selectStreamPeakViewers,
} from "@repo/supabase/queries/credits";
import { aggregateCredits, emptyCredits, type CreditsData, type CreditsPerson } from "@repo/schemas";
import { resolveUsers } from "./assets";
import { singleFlight } from "./cache";

/**
 * End-of-stream credits for a channel.
 *
 * Not in live.ts on purpose: that file promises nothing is ever cached, and
 * credits for a stream that already ended may sit in the browser for a few
 * minutes. The route decides that from `is_live`; here the only stampede
 * defence is `singleFlight`, same as the live counters.
 */

export interface CreditsOptions {
  /** A specific stream of the broadcaster's. Defaults to the live one, else the latest. */
  streamId?: string;
  /** Attach profile pictures. One Helix lookup per 100 people, through the asset cache. */
  avatars?: boolean;
}

/** Across every section; a stream with more people than this gets avatars for the first ones only. */
const AVATAR_CAP = 300;

export async function liveCredits(broadcasterId: string, opts: CreditsOptions = {}): Promise<CreditsData> {
  const key = `credits:${broadcasterId}:${opts.streamId ?? "auto"}:${opts.avatars ? 1 : 0}`;
  return singleFlight(key, async () => {
    const pick = await selectCreditsStream(supabase, broadcasterId, opts.streamId);
    if (!pick) return emptyCredits("stream");

    const [rows, peak] = await Promise.all([
      selectCreditsEventRows(supabase, pick.stream_id, broadcasterId),
      selectStreamPeakViewers(supabase, pick.stream_id),
    ]);

    const data = aggregateCredits(rows, {
      stream_id: pick.stream_id,
      broadcaster_id: broadcasterId,
      is_live: pick.is_live,
      started_at: pick.started_at,
      peak_viewers: peak,
    });

    if (opts.avatars) await attachAvatars(data);
    return data;
  });
}

const PEOPLE_SECTIONS = ["followers", "subs", "resubs", "gifters", "cheerers", "raids", "redeemers"] as const;

async function attachAvatars(data: CreditsData): Promise<void> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const section of PEOPLE_SECTIONS) {
    for (const p of data[section]) {
      if (p.user_id && !seen.has(p.user_id)) {
        seen.add(p.user_id);
        ids.push(p.user_id);
        if (ids.length >= AVATAR_CAP) break;
      }
    }
    if (ids.length >= AVATAR_CAP) break;
  }
  if (ids.length === 0) return;

  // resolveUsers already chunks Helix lookups by 100 and reads the cache first.
  const users = await resolveUsers(ids);
  const set = (p: CreditsPerson) => {
    const u = p.user_id ? users[p.user_id] : undefined;
    if (u?.profile_image_url) p.profile_image_url = u.profile_image_url;
  };
  for (const section of PEOPLE_SECTIONS) data[section].forEach(set);
}
