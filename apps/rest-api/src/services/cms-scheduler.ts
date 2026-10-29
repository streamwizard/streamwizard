import { contentIndexPath, contentPath, parseFootprint, tagsForChange, type ContentType } from "@repo/cms";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getCmsContentSummary } from "@repo/supabase/queries/cms/content";
import {
  claimCmsRevalidations,
  claimDueCmsScheduled,
  deleteCmsRevalidation,
  queueCmsRevalidation,
  retryCmsRevalidationAt,
  type CmsRevalidation,
} from "@repo/supabase/queries/cms/schedule";
import {
  getPlatformEventIdentity,
  logPlatformEvent,
  type EmitPlatformEventInput,
} from "@repo/supabase/queries/platform-events";
import { env } from "../lib/env";

/**
 * Blog and guides, the part that runs on a clock (docs/cms-plan.md §3):
 * - scheduled posts whose time has come go live (cms_claim_due_scheduled
 *   publishes them in the database, SKIP LOCKED, so two replicas are safe),
 *   then the site's cached pages are refreshed and the log channel told.
 * - cache refreshes the site didn't confirm (cms_revalidate_queue, from
 *   web-admin or from here) are retried with backoff. Every cached CMS read
 *   expires after an hour anyway, so a retry older than that is dropped.
 */
const TICK_MS = 30 * 1000;
const FIRST_TICK_DELAY_MS = 10 * 1000;
const DUE_BATCH = 20;
const RETRY_BATCH = 20;
/** Long enough for one refresh call to time out, short enough to retry soon. */
const RETRY_LEASE_SECONDS = 120;
const RETRY_GIVE_UP_MS = 60 * 60 * 1000;
/** A refresh that keeps failing this often is worth a look: the site may be down. */
const RETRY_REPORT_ATTEMPT = 3;
const REVALIDATE_TIMEOUT_MS = 5_000;

export interface DueResult {
  content_id: string;
  scheduled_by: string | null;
  ok: boolean;
  result: unknown;
  error: string | null;
}

export interface ContentSummary {
  type: ContentType;
  title: string;
  slug: string;
}

export interface RevalidateRequest {
  tags: string[];
  mode: "stale" | "immediate";
  indexNow: string[];
}

export interface CmsSchedulerDeps {
  claimDue: (limit: number) => Promise<DueResult[]>;
  summary: (contentId: string) => Promise<ContentSummary | null>;
  /** True when the site confirmed the refresh. */
  revalidate: (request: RevalidateRequest) => Promise<boolean>;
  queue: (request: RevalidateRequest) => Promise<void>;
  claimRetries: (limit: number, leaseSeconds: number) => Promise<CmsRevalidation[]>;
  deleteRetry: (id: number) => Promise<void>;
  retryAt: (id: number, at: Date, error: string) => Promise<void>;
  log: (event: EmitPlatformEventInput) => Promise<void>;
  actor: (userId: string | null) => Promise<{ actor_twitch_username: string | null; actor_avatar_url: string | null }>;
  /** web-streamwizard's origin, for links in the log channel. */
  siteUrl?: string;
  now?: () => number;
}

export interface CmsTickResult {
  published: number;
  failed: number;
  retried: number;
  dropped: number;
}

/** 1, 2, 4, 8 … minutes, capped at 15. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 15) * 60 * 1000;
}

export function createCmsScheduler(deps: CmsSchedulerDeps) {
  const now = deps.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<CmsTickResult> | null = null;

  const publicUrl = (type: ContentType, slug: string) =>
    deps.siteUrl ? new URL(contentPath(type, slug), deps.siteUrl).toString() : null;

  async function publishDue(result: CmsTickResult): Promise<void> {
    for (const row of await deps.claimDue(DUE_BATCH)) {
      const summary = await deps.summary(row.content_id);
      const actor = await deps.actor(row.scheduled_by);
      const base = summary
        ? { content_id: row.content_id, content_type: summary.type, title: summary.title, slug: summary.slug }
        : { content_id: row.content_id, content_type: "blog" as const, title: "", slug: "" };

      if (!row.ok) {
        result.failed += 1;
        await deps.log({
          type: "content.schedule_failed",
          actorUserId: row.scheduled_by,
          payload: { ...base, ...actor, error: row.error ?? "unknown error" },
        });
        continue;
      }

      result.published += 1;
      const published = (row.result ?? {}) as { before?: unknown; after?: unknown; first_publish?: boolean };
      const request: RevalidateRequest = {
        tags: tagsForChange(parseFootprint(published.before), parseFootprint(published.after)),
        mode: "immediate",
        indexNow: summary ? [contentPath(summary.type, summary.slug), contentIndexPath(summary.type)] : [],
      };
      if (request.tags.length > 0 && !(await deps.revalidate(request))) await deps.queue(request);
      await deps.log({
        type: "content.published",
        actorUserId: row.scheduled_by,
        payload: {
          ...base,
          ...actor,
          url: summary ? publicUrl(summary.type, summary.slug) : null,
          first_publish: published.first_publish !== false,
          scheduled: true,
        },
      });
    }
  }

  async function retryRefreshes(result: CmsTickResult): Promise<void> {
    for (const row of await deps.claimRetries(RETRY_BATCH, RETRY_LEASE_SECONDS)) {
      const request: RevalidateRequest = {
        tags: row.tags,
        mode: row.mode === "stale" ? "stale" : "immediate",
        indexNow: row.index_now_paths,
      };
      if (await deps.revalidate(request)) {
        result.retried += 1;
        await deps.deleteRetry(row.id);
        continue;
      }
      if (now() - new Date(row.created_at).getTime() > RETRY_GIVE_UP_MS) {
        // The cached copies have expired by themselves by now.
        result.dropped += 1;
        await deps.deleteRetry(row.id);
        continue;
      }
      if (row.attempts === RETRY_REPORT_ATTEMPT) {
        reportError(new Error("CMS cache refresh keeps failing"), "cms-scheduler: revalidate retry", {
          attempts: row.attempts,
          lastError: row.last_error,
        });
      }
      await deps.retryAt(row.id, new Date(now() + retryDelayMs(row.attempts)), "the site didn't confirm the refresh");
    }
  }

  async function run(): Promise<CmsTickResult> {
    const result: CmsTickResult = { published: 0, failed: 0, retried: 0, dropped: 0 };
    // Independent halves: a broken retry queue must not stop posts going live.
    await publishDue(result).catch((error) => reportError(error, "cms-scheduler: publish due"));
    await retryRefreshes(result).catch((error) => reportError(error, "cms-scheduler: retry refreshes"));
    return result;
  }

  function tick(): Promise<CmsTickResult> {
    if (inFlight) return inFlight;
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) return;
    const go = () =>
      tick().then((r) => {
        if (r.published || r.failed || r.dropped) {
          console.log(
            `[cms-scheduler] published ${r.published}, failed ${r.failed}, refreshes retried ${r.retried}, dropped ${r.dropped}`,
          );
        }
      });
    setTimeout(go, FIRST_TICK_DELAY_MS).unref?.();
    timer = setInterval(go, TICK_MS);
    timer.unref?.();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { tick, start, stop };
}

async function postRevalidate(request: RevalidateRequest): Promise<boolean> {
  if (!env.CMS_SITE_URL || !env.CMS_REVALIDATE_SECRET) return true;
  try {
    const response = await fetch(new URL("/api/revalidate", env.CMS_SITE_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${env.CMS_REVALIDATE_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const cmsScheduler = createCmsScheduler({
  claimDue: async (limit) => {
    const { data, error } = await claimDueCmsScheduled(supabase, limit);
    if (error) throw error;
    return (data ?? []) as DueResult[];
  },
  summary: async (contentId) => {
    const { data } = await getCmsContentSummary(supabase, contentId);
    return data ? { type: data.type === "guide" ? "guide" : "blog", title: data.title, slug: data.slug } : null;
  },
  revalidate: postRevalidate,
  queue: async (request) => {
    const { error } = await queueCmsRevalidation(supabase, {
      tags: request.tags,
      mode: request.mode,
      indexNowPaths: request.indexNow,
    });
    if (error) reportError(error, "cms-scheduler: queue revalidate");
  },
  claimRetries: async (limit, leaseSeconds) => {
    const { data, error } = await claimCmsRevalidations(supabase, limit, leaseSeconds);
    if (error) throw error;
    return data ?? [];
  },
  deleteRetry: async (id) => {
    const { error } = await deleteCmsRevalidation(supabase, id);
    if (error) throw error;
  },
  retryAt: async (id, at, lastError) => {
    const { error } = await retryCmsRevalidationAt(supabase, id, at.toISOString(), lastError);
    if (error) throw error;
  },
  log: (event) => logPlatformEvent(supabase, event, "rest-api cms-scheduler"),
  actor: async (userId) => {
    if (!userId) return { actor_twitch_username: null, actor_avatar_url: null };
    try {
      const identity = await getPlatformEventIdentity(supabase, userId);
      return { actor_twitch_username: identity.twitch_username, actor_avatar_url: identity.avatar_url };
    } catch {
      return { actor_twitch_username: null, actor_avatar_url: null };
    }
  },
  siteUrl: env.CMS_SITE_URL,
});
