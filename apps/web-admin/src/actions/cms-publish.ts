"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  contentIndexPath,
  contentPath,
  parseFootprint,
  tagsForChange,
  transition,
  type ContentStatus,
  type ContentType,
} from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { selectCmsAsset } from "@repo/supabase/queries/cms/assets";
import {
  getCmsContentForEditor,
  publishCmsContent,
  unarchiveCmsContent,
  unpublishCmsContent,
} from "@repo/supabase/queries/cms/content";
import { scheduleCmsContent, unscheduleCmsContent } from "@repo/supabase/queries/cms/schedule";
import { logPlatformEvent } from "@repo/supabase/queries/platform-events";
import { CmsError, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { classifyContentError } from "@/lib/cms/content-errors";
import { contentType, draftFromRow } from "@/lib/cms/draft-row";
import { blockingMessage, publicContentUrl } from "@/lib/cms/publish";
import { publishReadiness } from "@/lib/cms/readiness";
import { revalidateCms } from "@/lib/cms/revalidate";
import { env } from "@/lib/env";
import { actorIdentity } from "@/lib/platform-events";

// Moving a post on and off the public site. Every action re-checks on the
// server what the editor already showed (status, lock, publish checks), then
// lets the database function do the move in one transaction, refreshes the
// cached pages it touched and writes a log line.

const CONTENT_PATH = "/content";
const GONE = "That post doesn't exist anymore, or it's in the trash.";
const MOVED = "Someone else changed this post. Reload to get their version, then try again.";

const idSchema = z.string().uuid();

export interface PublishResult extends CmsActionResult {
  /** The post's new lock version, so the editor can keep saving. */
  lockVersion: number | null;
  /** The live page, when this environment knows the site's URL. */
  url: string | null;
}

async function loadForMove(id: string, lockVersion: number) {
  if (!idSchema.safeParse(id).success) throw new CmsError(GONE);
  const { data: row, error } = await getCmsContentForEditor(supabaseAdmin, id);
  if (error) throw error;
  if (!row || row.deleted_at) throw new CmsError(GONE);
  if (row.lock_version !== lockVersion) throw new CmsError(MOVED);
  return row;
}

function throwDbError(error: unknown): never {
  const failure = classifyContentError(error);
  if (failure.kind === "conflict") throw new CmsError(MOVED);
  if (failure.kind === "not_found") throw new CmsError(GONE);
  if (failure.kind === "message") throw new CmsError(failure.message);
  throw error;
}

type EditorRow = Awaited<ReturnType<typeof loadForMove>>;

/** The editor's publish checks, again on the server: an old tab or a crafted request can't skip them. */
async function assertPublishable(row: EditorRow): Promise<void> {
  const cover = row.cover_asset_id ? (await selectCmsAsset(supabaseAdmin, row.cover_asset_id)).data : null;
  const blocked = blockingMessage(
    publishReadiness(contentType(row), draftFromRow(row), {
      coverAlt: row.cover_asset_id
        ? cover
          ? { alt: cover.alt ?? "", decorative: cover.is_decorative }
          : null
        : undefined,
    }),
  );
  if (blocked) throw new CmsError(blocked);
}

/** The pages to tell IndexNow about: the post, its old URL after a slug change, and its index. */
function indexNowPaths(type: ContentType, slugs: (string | null | undefined)[]): string[] {
  const paths = slugs.flatMap((slug) => (slug ? [contentPath(type, slug)] : []));
  return [...new Set([...paths, contentIndexPath(type)])];
}

function refreshAdmin(id: string) {
  revalidatePath(CONTENT_PATH);
  revalidatePath(`${CONTENT_PATH}/${id}`, "layout");
}

/**
 * Publish a draft or archived post, or push a live post's changes ("Update").
 * `minorEdit` keeps the public "Updated" date: for typo fixes.
 */
export async function publishContentAction(id: string, lockVersion: number, minorEdit = false): Promise<PublishResult> {
  try {
    const actor = await requireCmsAdmin();
    const row = await loadForMove(id, lockVersion);
    const type = contentType(row);
    const status = row.status as ContentStatus;
    const update = status === "published";
    const move = transition(status, update ? "update" : "publish", { now: new Date() });
    if (!move.ok) throw new CmsError(move.error);

    await assertPublishable(row);

    const { data, error } = await publishCmsContent(supabaseAdmin, id, actor, lockVersion, update && minorEdit);
    if (error) throwDbError(error);
    const result = data as { before?: unknown; after?: unknown; lock_version: number; first_publish: boolean };

    // Immediate, not stale-while-revalidate: the next visit is usually the
    // admin's own "View on site", and it has to show what they just pushed.
    await revalidateCms(tagsForChange(parseFootprint(result.before), parseFootprint(result.after)), "immediate", {
      indexNow: indexNowPaths(type, [row.slug, row.published?.slug]),
    });
    const url = publicContentUrl(env.CMS_SITE_URL, type, row.slug);
    const base = {
      content_id: id,
      content_type: type,
      title: row.title,
      slug: row.slug,
      url,
      ...(await actorIdentity(actor)),
    };
    await logPlatformEvent(
      supabaseAdmin,
      update
        ? { type: "content.updated", actorUserId: actor, payload: { ...base, minor_edit: minorEdit } }
        : { type: "content.published", actorUserId: actor, payload: { ...base, first_publish: result.first_publish } },
      "web-admin cms: publish",
    );
    refreshAdmin(id);
    return { error: null, lockVersion: result.lock_version, url };
  } catch (error) {
    return {
      ...toCmsActionError(error, "publish content", "Couldn't publish. Nothing changed on the site, try again?"),
      lockVersion: null,
      url: null,
    };
  }
}

/** Off the site: back to a draft, or into the archive. Cached pages drop it right away. */
export async function unpublishContentAction(
  id: string,
  lockVersion: number,
  to: "draft" | "archived",
): Promise<PublishResult> {
  try {
    const actor = await requireCmsAdmin();
    if (to !== "draft" && to !== "archived") throw new CmsError("Pick draft or archive.");
    const row = await loadForMove(id, lockVersion);
    const move = transition(row.status as ContentStatus, to === "draft" ? "unpublish" : "archive", { now: new Date() });
    if (!move.ok) throw new CmsError(move.error);

    const { data, error } = await unpublishCmsContent(supabaseAdmin, id, actor, lockVersion, to);
    if (error) throwDbError(error);
    const result = data as { before?: unknown; lock_version: number };

    const type = contentType(row);
    await revalidateCms(tagsForChange(parseFootprint(result.before), null), "immediate", {
      indexNow: indexNowPaths(type, [row.published?.slug ?? row.slug]),
    });
    await logPlatformEvent(
      supabaseAdmin,
      {
        type: to === "draft" ? "content.unpublished" : "content.archived",
        actorUserId: actor,
        payload: {
          content_id: id,
          content_type: type,
          title: row.title,
          slug: row.slug,
          ...(await actorIdentity(actor)),
        },
      },
      "web-admin cms: unpublish",
    );
    refreshAdmin(id);
    return { error: null, lockVersion: result.lock_version, url: null };
  } catch (error) {
    return {
      ...toCmsActionError(error, "unpublish content", "Couldn't take it off the site. Try again?"),
      lockVersion: null,
      url: null,
    };
  }
}

/** Archived back to a draft. It wasn't on the site, so nothing there changes. */
export async function unarchiveContentAction(id: string, lockVersion: number): Promise<PublishResult> {
  try {
    const actor = await requireCmsAdmin();
    const row = await loadForMove(id, lockVersion);
    const move = transition(row.status as ContentStatus, "unarchive", { now: new Date() });
    if (!move.ok) throw new CmsError(move.error);

    const { data, error } = await unarchiveCmsContent(supabaseAdmin, id, actor, lockVersion);
    if (error) throwDbError(error);
    if (!data) throw new CmsError(MOVED);
    refreshAdmin(id);
    return { error: null, lockVersion: data.lock_version, url: null };
  } catch (error) {
    return {
      ...toCmsActionError(error, "unarchive content", "Couldn't move it back to drafts. Try again?"),
      lockVersion: null,
      url: null,
    };
  }
}

export interface ScheduleResult extends PublishResult {
  publishAt: string | null;
}

/**
 * Schedule a draft, or move a scheduled post to a new time. The publish
 * checks run now as well, so a post that can't go live isn't scheduled; the
 * rest-api scheduler publishes it at `publishAt` on this admin's behalf.
 */
export async function scheduleContentAction(
  id: string,
  lockVersion: number,
  publishAt: string,
): Promise<ScheduleResult> {
  try {
    const actor = await requireCmsAdmin();
    const row = await loadForMove(id, lockVersion);
    const when = new Date(publishAt);
    const move = transition(row.status as ContentStatus, "schedule", { now: new Date(), publishAt: when });
    if (!move.ok) throw new CmsError(move.error);
    await assertPublishable(row);

    const { data, error } = await scheduleCmsContent(supabaseAdmin, id, actor, lockVersion, when.toISOString());
    if (error) throwDbError(error);
    const result = data as { lock_version: number; publish_at: string };

    const type = contentType(row);
    await logPlatformEvent(
      supabaseAdmin,
      {
        type: "content.scheduled",
        actorUserId: actor,
        payload: {
          content_id: id,
          content_type: type,
          title: row.title,
          slug: row.slug,
          publish_at: result.publish_at,
          ...(await actorIdentity(actor)),
        },
      },
      "web-admin cms: schedule",
    );
    refreshAdmin(id);
    return { error: null, lockVersion: result.lock_version, url: null, publishAt: result.publish_at };
  } catch (error) {
    return {
      ...toCmsActionError(error, "schedule content", "Couldn't schedule it. Try again?"),
      lockVersion: null,
      url: null,
      publishAt: null,
    };
  }
}

/** Drop the schedule: back to a draft. */
export async function unscheduleContentAction(id: string, lockVersion: number): Promise<PublishResult> {
  try {
    const actor = await requireCmsAdmin();
    const row = await loadForMove(id, lockVersion);
    const move = transition(row.status as ContentStatus, "unschedule", { now: new Date() });
    if (!move.ok) throw new CmsError(move.error);

    const { data, error } = await unscheduleCmsContent(supabaseAdmin, id, actor, lockVersion);
    if (error) throwDbError(error);
    const result = data as { lock_version: number };

    await logPlatformEvent(
      supabaseAdmin,
      {
        type: "content.unscheduled",
        actorUserId: actor,
        payload: {
          content_id: id,
          content_type: contentType(row),
          title: row.title,
          slug: row.slug,
          ...(await actorIdentity(actor)),
        },
      },
      "web-admin cms: unschedule",
    );
    refreshAdmin(id);
    return { error: null, lockVersion: result.lock_version, url: null };
  } catch (error) {
    return {
      ...toCmsActionError(error, "unschedule content", "Couldn't cancel the schedule. Try again?"),
      lockVersion: null,
      url: null,
    };
  }
}
