"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tagsForChange, transition, type ContentStatus } from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { selectCmsAsset } from "@repo/supabase/queries/cms/assets";
import {
  getCmsContentForEditor,
  publishCmsContent,
  unarchiveCmsContent,
  unpublishCmsContent,
} from "@repo/supabase/queries/cms/content";
import { logPlatformEvent } from "@repo/supabase/queries/platform-events";
import { CmsError, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { classifyContentError, toFootprint } from "@/lib/cms/content-errors";
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

    const cover = row.cover_asset_id ? (await selectCmsAsset(supabaseAdmin, row.cover_asset_id)).data : null;
    const blocked = blockingMessage(
      publishReadiness(type, draftFromRow(row), {
        coverAlt: row.cover_asset_id
          ? cover
            ? { alt: cover.alt ?? "", decorative: cover.is_decorative }
            : null
          : undefined,
      }),
    );
    if (blocked) throw new CmsError(blocked);

    const { data, error } = await publishCmsContent(supabaseAdmin, id, actor, lockVersion, update && minorEdit);
    if (error) throwDbError(error);
    const result = data as { before?: unknown; after?: unknown; lock_version: number; first_publish: boolean };

    // Immediate, not stale-while-revalidate: the next visit is usually the
    // admin's own "View on site", and it has to show what they just pushed.
    await revalidateCms(tagsForChange(toFootprint(result.before), toFootprint(result.after)), "immediate");
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

    await revalidateCms(tagsForChange(toFootprint(result.before), null), "immediate");
    const type = contentType(row);
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
