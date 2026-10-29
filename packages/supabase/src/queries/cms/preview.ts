import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * CMS preview links. Only the sha256 of a token is stored, as PostgREST bytea
 * text ("\x" + hex). Service-role client only: the public preview page looks a
 * token up with it after hashing the one in the URL.
 */

type DBClient = SupabaseClient<Database>;

export const insertCmsPreviewToken = withMetrics(
  "cms_preview_tokens",
  "insert",
  async (client: DBClient, input: { contentId: string; tokenHash: string; expiresAt: string; createdBy: string }) =>
    client
      .from("cms_preview_tokens")
      .insert({
        content_id: input.contentId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        created_by: input.createdBy,
      })
      .select("id, expires_at, created_at")
      .single(),
);

/** Links that still work, newest first. */
export const listActiveCmsPreviewTokens = withMetrics(
  "cms_preview_tokens",
  "select",
  async (client: DBClient, contentId: string) =>
    client
      .from("cms_preview_tokens")
      .select("id, expires_at, created_at")
      .eq("content_id", contentId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
);

export const revokeCmsPreviewToken = withMetrics(
  "cms_preview_tokens",
  "update",
  async (client: DBClient, id: string, contentId: string) =>
    client
      .from("cms_preview_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("content_id", contentId)
      .is("revoked_at", null),
);

/** The token and the working copy it shows, with everything the article needs. */
export const getCmsPreviewByHash = withMetrics(
  "cms_preview_tokens",
  "select",
  async (client: DBClient, tokenHash: string) =>
    client
      .from("cms_preview_tokens")
      .select(
        `expires_at, revoked_at,
       content:cms_content(
         id, type, status, title, slug, excerpt, summary, body, toc, reading_time_minutes, word_count,
         difficulty, estimated_minutes, prerequisites, updated_at, first_published_at, deleted_at,
         cover:cms_assets!cms_content_cover_asset_id_fkey(key, alt, is_decorative, width, height),
         sections:cms_guide_sections(id, position, title, anchor, body),
         credits:cms_content_authors(position, author:cms_authors(id, slug, name, role_title, avatar:cms_assets(key))),
         categories:cms_content_categories(category:cms_categories(id, slug, name)),
         tags:cms_content_tags(tag:cms_tags(id, slug, name))
       )`,
      )
      .eq("token_hash", tokenHash)
      .maybeSingle(),
);
